import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import Router from 'koa-router';
import uuid from 'uuid/v1';
import { EventEmitter } from 'events';
import { RequestType, Response, IQueryInterface } from '../..';
import { Message } from '..';

export class HttpInterface extends EventEmitter implements IQueryInterface {

  private pending: Map<string, Function> = new Map()

  constructor(port: number) {
    super();
    const app = new Koa();
    app.use(bodyParser());
    const router = new Router();
    router.get('/query', async ctx => {
      const { key } = ctx.request.query;
      const id = uuid();
      const message: Message = {
        type: 'request',
        payload: {
          id,
          type: RequestType.Query,
          key,
          value: undefined,
        }
      };
      const response = await this._awaitResponse(message);
      ctx.body = response;
    });
    router.post('/update', async ctx => {
      const { key, value } = ctx.request.body as any;
      const message: Message = {
        type: 'request',
        payload: {
          type: RequestType.Update,
          id: uuid(),
          key,
          value,
        }
      };
      const response = await this._awaitResponse(message);
      ctx.body = response;
    });
    app.use(router.routes());
    app.listen(port);
  }

  private _awaitResponse(message: Message): Promise<Response> {
    const promise: Promise<Response> = new Promise((res) => {
      this.pending.set(message.payload.id, res);
    });
    this.emit('message', message);
    return promise;
  }

  public onResponse(response: Response) {
    const res = this.pending.get(response.id);
    if (res) {
      this.pending.delete(response.id);
      res(response);
    }
  }
}
