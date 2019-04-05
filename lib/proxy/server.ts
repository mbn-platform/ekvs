import { Server } from 'ws';
import urpc from 'urpc';
export function createServer() {
  const wsServer = new Server({ port: 8000});
  wsServer.on('connection', (ws) => {
    const stream = new urpc.Stream(hander);
    ws.onmessage = (event) => {
      stream.write(event.data);
    };
    ws.onclose = (_event) => {
      stream.end();
    };
    stream.on('data', (msg: any) => {
      ws.send(JSON.stringify(msg));
    });
    stream.on('finish', () => {
      console.log('finish');
      ws.close();
    });
    stream.on('error', (e: any) => {
      console.log(e);
    });
  });
  return wsServer;
}

enum Method {
  Query = 'query',
  Update = 'update',
}

async function hander(req: urpc.Request, res: urpc.Response) {
  console.log(req);
  await new Promise((res) => setTimeout(res, 5000));
  switch (req.method) {
    case Method.Query:
      res.result = {succes: true};
      break;
    case Method.Update:
      res.result = {success: true};
      break;
    default:
      res.error = urpc.Error.methodNotFound(req.method);
  }
}

createServer();
