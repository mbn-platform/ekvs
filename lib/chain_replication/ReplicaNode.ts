import InMemoryStorageLevelDb from '../inmemory/inmemory_leveldb';
import { IRemoteReplicaNode } from './remote';
import { Request, Response, RequestType, QueryRequest, UpdateRequest } from '.';
import { OperationQueue } from './OperationQueue';

export class ReplicaNode {

  private readonly db: InMemoryStorageLevelDb;
  private prevNode?: IRemoteReplicaNode;
  private nextNode?: IRemoteReplicaNode;
  protected name: string;

  private pending: Map<string, Request> = new Map();

  private requestQueue: OperationQueue<Request>;
  private responseQueue: OperationQueue<Response>;

  constructor(db: InMemoryStorageLevelDb, name: string = 'nodename') {
    this.name = name;
    this.db = db;
    this.requestQueue = new OperationQueue(async (request) => {
      await this._handleRequest(request);
    });
    this.responseQueue = new OperationQueue(async (response) => {
      await this._handleResponse(response);
    })
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
        console.log(`${this.name} return value for ${response.key}: ${response.value}`);
        break;
      }
      case RequestType.Update: {
        this.pending.set(request.id, request);
        if (this.nextNode) {
          console.log('propagating down');
          await this.nextNode.propagateDown(request);
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
      await this.prevNode.propagateUp(response);
    }
  }

}
