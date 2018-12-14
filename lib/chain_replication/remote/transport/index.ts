import { Message } from '..';
/**
 * Abstract transport layer for exchanging messages with other node
 */
export interface Transport {
  on(event: 'message', listener: (this: Transport, message: Message) => void): this;
  send(message: Message): void;
}
