import { IRemoteReplicaNode } from '.';
import { ReplicaNode } from '../ReplicaNode';
import { Transport } from './transport';
import { Request, Response } from '..';
export class RemoteReplicaNode implements IRemoteReplicaNode {

  private node: ReplicaNode;
  private transport: Transport;

  public ready: boolean = false;

  constructor(node: ReplicaNode, transport: Transport) {
    this.node = node;
    this.transport = transport;
    transport.on('message', (msg) => {
      switch (msg.type) {
        case 'request':
          this.node.handleRequest(msg.payload as Request);
          break;
        case 'response':
          this.node.handleResponse(msg.payload as Response);
          break;
      }
    });
    transport.on('open', () => {
      console.log('transport open');
      this.onOpen();
      this.ready = true;
    });
    transport.on('close', () => {
      console.log('transport closed');
      this.ready = false;
      this.onClose();
    });
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

  public onOpen() {
    console.log('not implemented');
  }

  public onClose() {
    console.log('not implemented');
  }
}
