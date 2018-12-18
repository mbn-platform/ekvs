import leveldown, { Bytes, LevelDown } from 'leveldown';
import levelup, { LevelUp } from 'levelup';
import crypto from 'crypto';

import { IPersistantStorage } from './';
import InMemoryStorage from './inmemory';

interface Options {
  publicKey: string;
  path: string;
}

class InMemoryStorageLevelDb extends InMemoryStorage<string, Bytes> implements IPersistantStorage {

  private newValues = new Map<string, Bytes>();
  private isFlushing = false;
  private db: LevelUp<LevelDown>;
  /**
   * RSA public key that will be used to store values in db
   */
  private publicKey: string;

  constructor(options: Options) {
    super();
    this.publicKey = options.publicKey;
    this.db = levelup(leveldown(options.path));
  }

  /**
   * Call after finishing working with storage.
   * Cannot open a second db to the same store in single thread, if previous wasn't closed.
   */
  public async close() {
    await this.db.close();
  }

  public async hasStored(key: string): Promise<boolean> {
    const value = await this._getFromStore(key);
    return value !== undefined;
  }

  public put(key: string, value: Bytes) {
    super.put(key, value);
    this.newValues.set(key, value);
  }

  public getEncrypted(): Promise<Map<string, Buffer>> {
    const map = new Map();
    return new Promise((res, rej) => {
      this.db.createReadStream()
        .on('data', (data: {key: Buffer, value: Buffer}) => {
          const value = data.value;
          const key = data.key.toString('utf8');
          if (!this.map.has(key)) {
            map.set(key, value);
          }
        })
        .on('end', () => res(map))
        .on('error', e => rej(e));
    });
  }

  /**
   * Save all new values to the storage
   */
  public async flush(): Promise<void> {
    if (this.isFlushing) {
      throw new Error('storage is syncing');
    }

    this.isFlushing = true;

    try {
      for(const [key, value] of this.newValues.entries()) {
        await this._storeEncrypted(key, value);
        this.newValues.delete(key);
      }
    }
    catch (e) {
      console.error(e);
      throw new Error('failed to flush to storage');
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Restores key value to the memory
   *
   * @param key
   * @param value
   * @param hashSign - signed sha256 hash of the value
   * @throws If key-value is already in memory, if there is no such key in storage,
   *         if signature is invalid
   *
   */
  public async restore(key: string, value: Bytes, hashSign: string): Promise<void> {
    if (this.map.has(key)) {
      throw new Error('already stored');
    }
    const storedValue = await this._getFromStore(key);
    if (!storedValue) {
      throw new Error('no such value');
    }
    if (this._checkSign(value, hashSign)) {
      this.map.set(key, value);
    } else {
      throw new Error('invalid signature');
    }
  }

  public getStored(key: string): Promise<Bytes|void> {
    return this._getFromStore(key);
  }

  public getStatus(key: string): Promise<number> {
    let mask = 0;
    if (this.map.has(key)) {
      mask |= 1;
    }

    return new Promise((res) => {
      this.db.get(key, (_, value) => {
        if (value) {
          mask |= 2;
        }
        res(mask);
      });
    });
  }

  /**
   * Encryption function that is applied to
   * stored values
   */
  private _encrypt(value: Bytes): Buffer {
    let buffer: Buffer;
    if (typeof value === 'string') {
      buffer = Buffer.from(value);
    } else {
      buffer = value;
    }
    if (this.publicKey) {
      return crypto.publicEncrypt({
        key: this.publicKey,
      }, buffer);
    } else {
      return buffer;
    }
  }

  /**
   * utility method for checking signatures
   * @param value
   * @param hashSign - signed sha256 hash of the value
   */
  private _checkSign(value: Bytes, hashSign: string): boolean {
    const hash = crypto.createHash('sha256').update(value).digest('hex');
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(hash);
    return verify.verify(this.publicKey, hashSign, 'hex');
  }

  private _storeEncrypted(key: string, value: Bytes): Promise<void> {
    return this._store(key, this._encrypt(value));
  }


  /**
   * Wrapper for levelup callback api
   */
  private _store(key: string, buffer: Buffer): Promise<void> {
    return new Promise((res, rej) => {
      this.db.put(key, buffer, (err) => {
        if (err) {
          rej(err);
        } else {
          res();
        }
      });
    });
  }

  /**
   * Wrapper for levelup callback api
   */
  private _getFromStore(key: string): Promise<Bytes|void> {
    return new Promise((res) => {
      this.db.get(key, (_, value) => {
        if (value) {
          res(value);
        } else {
          res();
        }
      });
    });
  }
}

export default InMemoryStorageLevelDb;
