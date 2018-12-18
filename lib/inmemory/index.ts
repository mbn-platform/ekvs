export interface IKeyValueStorage<K, V> {

  put(key: K, value: V): void;
  get(key: K): V|undefined;

}

export interface IPersistantStorage {
  flush: Function;
}
