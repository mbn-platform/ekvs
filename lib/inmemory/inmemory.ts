import { IKeyValueStorage } from './';
class InMemoryStorage<K, V> implements IKeyValueStorage<K, V> {
  protected map = new Map<K, V>();

  public put(key: K, value: V) {
    this.map.set(key, value);
  }

  public get(key: K): V|undefined {
    return this.map.get(key);
  }
}

export default InMemoryStorage;
