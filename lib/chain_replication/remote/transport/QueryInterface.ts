import urpc from 'urpc';
import ws from 'ws';
import { EventEmitter } from 'events';
import { Message } from '..';
import { IQueryInterface } from '../..';

export class SomeWebSocketServer extends EventEmitter implements IQueryInterface {

  private pending: any[] = [];

  constructor(port) {
    super();
    const server = new ws.Server({port});
    server.on('connection', (socket) => {
      new SocketHandler(ws, this);
    });
  }
}

class SocketHandler {
  constructor(socket: ws, qi: IQueryInterface) {
    qi.on
    const stream = new urpc.Stream(this.handler);
    socket.onmessage = (event) => {
      stream.write(event.data);
    }
    socket.onerror = (_event) => {};
    socket.onclose = (event) => {
      stream.end();
    };
    stream.on('finish', () => {
      socket.close();
    });
    stream.on('data', (msg) => {
      socket.send(JSON.stringify(msg));
    });
  }

  private async awaitResponse(req: urpc.Request) {
  }

  handler = async (req: urpc.Request, res: urpc.Response) => {
    switch (req.method) {
      case Method.Query:
        await this
        break;
      case Method.Update:
        break;
      default:
        res.error = urpc.Error.methodNotFound(req.method);
    }
  }
}

enum Method {
  Query = 'query',
  Update = 'update',
}

async function handler(req: urpc.Request, res: urpc.Response) {
  switch (req.method) {
      case Method.Query: {
        break;
      }
    default:
      res.error = urpc.Error.methodNotFound(req.method);
  }
}
