import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { Message } from '..';
import { Transport } from '.';

export class WebServerTransport extends EventEmitter implements Transport {
  private ws?: WebSocket;
  constructor(port: number) {
    super();
    const wss = new WebSocket.Server({ port });
    wss.on('connection', (ws) => {
      console.log('connected to wss');
      ws.on('message', (data) => {
        const message = parseData(data);
        this.emit('message', message);
      });
      this.ws = ws;
    });
  }

  public send(message: Message) {
    if (this.ws) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

export class WebSocketTrasport extends EventEmitter {
  private ws: WebSocket;
  constructor(url: string) {
    super();
    const ws = new WebSocket(url);
    ws.on('message', (data) => {
      const message = parseData(data);
      this.emit('message', message);
    });
    this.ws = ws;
  }

  public send(message: Message) {
    this.ws.send(JSON.stringify(message));
  }
}

function parseData(data: WebSocket.Data): Message {
  if (typeof data === 'string') {
    const json = JSON.parse(data);
    return json;
  }
  throw new Error('invalid data');
}
