import InMemoryStorageLevelDb from '../inmemory/inmemory_leveldb';
import { IRemoteReplicaNode } from './remote';
import { Request, Response, RequestType,
  QueryRequest, UpdateRequest,
  IQueryInterface
} from '.';
import { OperationQueue } from './OperationQueue';

export class ReplicaNode {

  private readonly db: InMemoryStorageLevelDb;
  private prevNode?: IRemoteReplicaNode;
  private nextNode?: IRemoteReplicaNode;
  private queryInterface?: IQueryInterface;
  protected name: string;

  private pending: Map<string, Request> = new Map();

  private requestQueue: OperationQueue<Request>;
  private responseQueue: OperationQueue<Response>;

  constructor(db: InMemoryStorageLevelDb, name: string = 'nodename') {
    this.name = name;
    this.db = db;
    this.requestQueue = new OperationQueue(async (request) => {
      await this._handleRequest(request);
      return true;
    });
    this.responseQueue = new OperationQueue(async (response) => {
      await this._handleResponse(response);
      return true;
    });
  }

  public handleRequest(request: Request) {
    this.requestQueue.add(request);
  }

  public handleResponse(response: Response) {
    this.responseQueue.add(response);
  }

  public setNext(node: IRemoteReplicaNode) {
    this.nextNode = node;
  }

  public setPrevious(node: IRemoteReplicaNode) {
    this.prevNode = node;
  }

  public setQueryInterface(q: IQueryInterface) {
    this.queryInterface = q;
    q.on('message', message => {
      this.handleRequest(message.payload as Request);
    });
  }

  get isTail(): boolean {
    return this.nextNode === undefined;
  }

  get isHead(): boolean {
    return this.prevNode === undefined;
  }

  public stat() {
    return this.db.count();
  }

  private async _handleRequest(request: Request) {
    console.log(`${this.name} handle request ${request.id}`);
    console.log(request);
    switch (request.type) {
      case RequestType.Query: {
        const req = request as QueryRequest;
        if (this.nextNode) {
          throw new Error('query request should be headed to the tail');
        }
        const value = this.db.get(req.key);
        const response = {
          id: req.id,
          key: req.key,
          value,
        };
        //TODO: handle response for query
        if (this.queryInterface) {
          this.queryInterface.onResponse(response);
        }
        break;
      }
      case RequestType.Update: {
        this.pending.set(request.id, request);
        if (this.nextNode) {
          await this.nextNode.send({
            type: 'request',
            payload: request,
          });
        } else {
          const req = request as UpdateRequest;
          const response = {
            id: req.id,
            key: req.key,
            value: req.value,
          };
          this.handleResponse(response);
        }
        break;
      }
    }
  }

  private async _handleResponse(response: Response) {
    console.log(`${this.name} handle response ${response.id}`);
    console.log(`${this.name} store ${response.key} ${response.value}`);
    this.db.put(response.key, response.value!);
    await this.db.flush();
    this.pending.delete(response.id);
    if (this.prevNode) {
      await this.prevNode.send({
        type: 'response',
        payload: response,
      });
    } else if (this.queryInterface) {
      this.queryInterface.onResponse(response);
    }
  }

}
