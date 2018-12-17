import { Request, Response } from '..';

export interface IRemoteReplicaNode {
  send(message: Message): void;
}

export interface Message {
  type: 'request'|'response'|'ack';
  payload: Request|Response|Ack;
}

export interface Ack {
  id: string;
}
