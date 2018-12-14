type Callback<T> = (element: T) => Promise<any>;

/**
 * Util class for processing requests
 */
export class OperationQueue<T> {
  private queue: T[] = [];
  private handler: Callback<T>;


  constructor(handler: Callback<T>) {
    this.handler = handler;
  }

  public add(elem: T) {
    this.queue.push(elem);
    if (this.queue.length === 1) {
      this.handleQueue();
    }
  }

  private async handleQueue() {
    while (this.queue.length !== 0) {
      const elem = this.queue[0];
      await this.handler(elem);
      this.queue.shift();
    }
  }
}
