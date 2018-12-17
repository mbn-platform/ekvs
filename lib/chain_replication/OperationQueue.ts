type Callback<T> = (element: T) => Promise<boolean>;

/**
 * Util class for processing requests
 */
export class OperationQueue<T> {
  private queue: T[] = [];
  private handler: Callback<T>;

  private isHandling = false;


  constructor(handler: Callback<T>) {
    this.handler = handler;
  }

  public add(elem: T) {
    this.queue.push(elem);
    this.handleQueue();
  }

  public async handleQueue() {
    if (this.isHandling) {
      return;
    }
    this.isHandling = true;
    while (this.queue.length !== 0) {
      const elem = this.queue[0];
      const success = await this.handler(elem);
      if (success) {
        this.queue.shift();
      } else {
        break;
      }
    }
    this.isHandling = false;
  }
}
