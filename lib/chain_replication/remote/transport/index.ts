import { Message } from '..';
/**
 * Abstract transport layer for exchanging messages with other node
 */
export interface Transport {
  on(event: 'message', listener: (this: Transport, message: Message) => void): this;
  on(event: 'open', listener: (this: Transport) => void): this;
  on(event: 'close', listener: (this: Transport) => void): this;
  send(message: Message): void;
}
