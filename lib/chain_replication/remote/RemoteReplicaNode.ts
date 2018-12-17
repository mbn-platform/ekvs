import { IRemoteReplicaNode, Message } from '.';
import { ReplicaNode } from '../ReplicaNode';
import { Transport } from './transport';
import { Request, Response } from '..';
export class RemoteReplicaNode implements IRemoteReplicaNode {

  private node: ReplicaNode;
  private transport: Transport;
  private toSend: Message[] = [];

  public ready: boolean = false;

  constructor(node: ReplicaNode, transport: Transport) {
    this.node = node;
    this.transport = transport;
    transport.on('message', (msg) => {
      console.log('transport message', msg);
      switch (msg.type) {
        case 'request':
          this.node.handleRequest(msg.payload as Request);
          this.transport.send({
            type: 'ack',
            payload: { id: msg.payload.id},
          });
          break;
        case 'response':
          this.node.handleResponse(msg.payload as Response);
          this.transport.send({
            type: 'ack',
            payload: { id: msg.payload.id},
          });
          break;
        case 'ack':
          const current = this.toSend[0];
          if (current && current.payload.id === msg.payload.id) {
            this.toSend.shift();
            this._sendNext();
          }
          break;
      }
    });
    transport.on('open', () => {
      console.log('transport open');
      this.ready = true;
      this._sendNext();
    });
    transport.on('close', () => {
      console.log('transport closed');
      this.ready = false;
    });
  }

  public send(message: Message) {
    this.toSend.push(message);
    if (this.ready && this.toSend.length === 1) {
      this._sendNext();
    }
  }

  public async propagateUp(response: Response) {
    this.transport.send({
      type: 'response',
      payload: response,
    });
  }

  public async propagateDown(request: Request) {
    this.transport.send({
      type: 'request',
      payload: request,
    });
  }

  private _sendNext() {
    const message = this.toSend[0];
    if (message) {
      this.transport.send(message);
    }
  }
}
