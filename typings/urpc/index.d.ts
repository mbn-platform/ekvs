declare class TypedEmitter {
  on(event: string, listener: any): this;
}

declare module 'urpc' {
  class Stream extends TypedEmitter {

    constructor(handler: (req: Request, res: Response) => void);

    push(data: any): void;
    isClosed: boolean;
    write(message: any): void;
    handleRequest(message: any): void;
    handleResponse(message: any): void;
    end(): void;

    on(event: 'finish', listener: (this: Stream) => void): this;
    on(event: 'data', listener: (this: Stream, message: any) => void): this;
    on(event: 'error', listener: (this: Stream, error: any) => void): this;
  }

  interface IRequest {
    id: any;
    method: string;
    params: any[];
    version: string;
  }

  class Request {
    constructor(opts?: RequestOptions);
    id: any;
    method: string;
    params: any[];
    version: string;
  }
  interface RequestOptions {
    id: any;
    method: string;
    params?: any[];
    jsonrpc: string;
  }

  class Response {
    constructor(opts?: ResponseOptions);
    result: any;
    error: any;
    toJSON(): any;
    valueOf: any;
  }

  interface ResponseOptions {
    id: any;
  }

  var Error: typeof RpcError;

  interface RpcResponse {
    jsonrpc: string;
    id: any;
    result: any;
  }
  const PARSE_ERROR: number;
  const INVALID_REQUES: number;
  const METHOD_NOT_FOUN: number;
  const INVALID_PARAM: number;
  const INTERNAL_ERROR: number;

}
declare class RpcError extends Error {
  constructor(opts?: {code: number, message: string, data: any});
  static methodNotFound(method: string): RpcError;
}
