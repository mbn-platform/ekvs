import { Bytes } from 'leveldown';
import InMemoryStorageLevelDb from '../inmemory/inmemory_leveldb';

enum RequestType {
  Update, Query
}

interface Request {
  id: string;
  type: RequestType;
  key: string;
  value: string|Buffer|undefined;
}

interface Response {
  id: string;
  key: string;
  value: string|Buffer|undefined;
}

interface UpdateRequest extends Request {
  type: RequestType.Update;
  value: string|Buffer;
}
interface QueryRequest extends Request {
  type: RequestType.Query;
}

interface RemoteChainReplica {
  handleUpdate(request: Request): Promise<void>;
}

export class LocalChainReplica implements RemoteChainReplica {
  private readonly replica: ChainReplica;
  constructor(replica: ChainReplica) {
    this.replica = replica;
  }

  public handleUpdate(request: UpdateRequest) {
    return this.replica.handleUpdate(request);
  }
}

type RequestChain = [Request, Function, Function];

export class ChainReplica {


  private pendingRequests: RequestChain[] = [];
  private db: InMemoryStorageLevelDb;

  constructor(db: InMemoryStorageLevelDb, next?: RemoteChainReplica) {
    this.nextReplica = next;
    this.db = db;
  }

  private readonly nextReplica?: RemoteChainReplica;

  get isTail(): boolean {
    return this.nextReplica === undefined;
  }

  public async handleNewRequest(request: Request) {
    const promise = new Promise((res, rej) => {
      this.pendingRequests.push([request, res, rej]);
    });
    if (this.pendingRequests.length === 1) {
      this.handleRequests();
    }
    return promise;
  }

  public async handleRequests() {
    while (this.pendingRequests.length !== 0) {
      const data = this.pendingRequests.shift()!;
      try {
        const response = await this.handleRequest(data[0]);
        data[1](response);
      } catch (e) {
        data[2](e);
      }
    }
  }

  async handleRequest(request: Request) {
    switch (request.type) {
      case RequestType.Update: {
        return this.handleUpdate(request as UpdateRequest);
      }
      case RequestType.Query: {
        return this.handleQuery(request as QueryRequest);
      }
    }
  }

  async handleUpdate(request: UpdateRequest) {
    if (!this.isTail) {
      await this.nextReplica!.handleUpdate(request);
    }
    this.db.put(request.key, request.value);
    await this.db.flush();
  }

  async handleQuery(request: QueryRequest): Promise<Bytes|undefined> {
    if (!this.isTail) {
      throw new Error('query requests should be headed to tail');
    }
    const value = this.db.get(request.key);
    return value;
  }

}

interface RemoteReplicaNode {
  propagateUp(response: Response): Promise<void>;
  propagateDown(request: Request): Promise<void>;
}


export class ReplicaNode {

  private readonly db: InMemoryStorageLevelDb;
  private prevNode?: RemoteReplicaNode;
  private nextNode?: RemoteReplicaNode;
  private pending: Map<string, Request> = new Map();

  constructor(db: InMemoryStorageLevelDb) {
    this.db = db;
  }

  public setNext(node: RemoteReplicaNode) {
    this.nextNode = node;
  }

  public setPrevious(node: RemoteReplicaNode) {
    this.prevNode = node;
  }

  get isTail(): boolean {
    return this.nextNode === undefined;
  }

  get isHead(): boolean {
    return this.prevNode === undefined;
  }

  public async handleRequest(request: Request) {
    this.pending.set(request.id, request);
    if (this.nextNode) {
      this.nextNode.propagateDown(request);
    } else {
      const response = await this.generateResponse(request);
      await this.handleResponse(response);
    }
  }

  public async handleResponse(response: Response) {
    const request = this.pending.get(response.id);
    if (!request) {
      return;
    }
    if (request.type === RequestType.Update) {
      const req = request as UpdateRequest;
      await this.update(req.key, req.value);
    }
    this.pending.delete(request.id);
    if (this.prevNode) {
      this.prevNode.propagateUp(response);
    }
  }

  /**
   * This method is only called on tail node
   */
  private async generateResponse(request: Request): Promise<Response> {
    switch (request.type) {
      case RequestType.Query: {
        const value = this.db.get(request.key);
        const response = {
          id: request.id,
          key: request.key,
          value,
        }
        return response;
      }
      case RequestType.Update: {
        const req = request as UpdateRequest;
        this.db.put(req.key, req.value);
        await this.db.flush();
        const response = {
          id: request.id,
          key: request.key,
          value: req.value,
        }
        return response;
      };
    }
  }

  private async update(key: string, value: string|Buffer) {
    this.db.put(key, value);
    await this.db.flush();
  }
}

export class LocalReplicaNode extends ReplicaNode {

  propagateDown(response: Response) {
    this.handleResponse(response);
  }

  propagateUp(request: Request) {
    this.handleRequest(request);
  }
}
