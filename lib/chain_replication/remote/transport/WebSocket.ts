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
      if (this.ws) {
        console.log('second connect');
        return;
      }
      this.ws = ws;
      this.emit('open');
      ws.onclose = (_event) => {
        this.ws = undefined;
        this.emit('close');
      };
      ws.onmessage = (event) => {
        const message = parseData(event.data);
        this.emit('message', message);
      };
      ws.onerror = (_event) => {
        console.log('socket error');
      }
    });
  }

  public send(message: Message) {
    if (this.ws) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('cannot send: no socket open');
    }
  }
}

export class WebSocketTrasport extends EventEmitter implements Transport {

  private ws?: WebSocket;
  private url: string;
  private isConnecting = false;
  private isOpen = false;

  constructor(url: string) {
    super();
    this.url = url;
    this.connect();
  }

  private connect = () => {
    if (this.isConnecting) {
      return;
    }
    this.isConnecting = true;
    const ws = new WebSocket(this.url);
    ws.onopen = (event) => {
      this.ws = event.target;
      this.isConnecting = false;
      this.isOpen = true;
      console.log('ws opened');
      this.emit('open');
    };
    ws.onmessage = (event) => {
      const message = parseData(event.data);
      this.emit('message', message);
    };
    ws.onerror = (_e) => {
      console.log('socket error');
    };
    ws.onclose = (event) => {
      this.ws = undefined;
      if (this.isOpen) {
        this.isOpen = false;
        this.emit('close');
      }
      if (this.isConnecting) {
        this.isConnecting = false;
      }
      console.log('socket closed', event.reason);
      console.log('reconnecting in 1000');
      setTimeout(this.connect, 1000);
    };
  }

  public send(message: Message) {
    if (this.ws) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('cannot send');
    }
  }
}

function parseData(data: WebSocket.Data): Message {
  if (typeof data === 'string') {
    const json = JSON.parse(data);
    return json;
  }
  throw new Error('invalid data');
}
