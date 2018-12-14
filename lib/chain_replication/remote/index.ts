import { Request, Response } from '..';

export interface IRemoteReplicaNode {
  propagateUp(response: Response): Promise<void>;
  propagateDown(request: Request): Promise<void>;
}

export interface Message {
  type: 'request'|'response';
  payload: Request|Response;
}
