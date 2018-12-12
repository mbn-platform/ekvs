import leveldown, { Bytes, LevelDown } from 'leveldown';
import levelup, { LevelUp } from 'levelup';
import crypto from 'crypto';
import constants from 'constants';

import { IPersistantStorage } from './';
import InMemoryStorage from './inmemory';

interface Options {
  publicKey: string;
  path: string;
  modulusLength: number;
}

class InMemoryStorageLevelDb extends InMemoryStorage<string, Bytes> implements IPersistantStorage {

  public readonly RSA_SIZE: number;

  /** Cache for data which is not yet encrypted and stored */
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
    this.RSA_SIZE = options.modulusLength / 8;
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

  /**
   * Get all values, that are stored and encrypted, but not in memory
   */
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

    const chachaKey = crypto.randomBytes(40);
    const encryptedKey = crypto.publicEncrypt({
      key: this.publicKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    }, chachaKey);

    const leadingNoise = getRandomBuffer();
    const trailingNoise = getRandomBuffer();
    const metaBuffer = Buffer.alloc(7);
    metaBuffer[0] = leadingNoise.length + 7;
    metaBuffer.writeUIntBE(buffer.length, 1, 6);

    const data = Buffer.concat([metaBuffer, leadingNoise, buffer, trailingNoise]);

    const cipher = crypto.createCipher('chacha20', chachaKey);
    const encryptedData = cipher.update(data);
    cipher.final();

    const total = Buffer.concat([encryptedKey, encryptedData]);
    return total;
  }

  public decrypt(value: Buffer, privateKey: string) {
    const encryptedKey = value.slice(0, this.RSA_SIZE);
    const encryptedData = value.slice(this.RSA_SIZE);

    const decryptedKey = crypto.privateDecrypt({
      key: privateKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    }, encryptedKey);

    const decipher = crypto.createDecipher('chacha20', decryptedKey);
    const decryptedData = decipher.update(encryptedData);
    decipher.final();

    const dataOffset = decryptedData[0];
    const dataLength = decryptedData.readUIntBE(1, 6);

    return decryptedData.slice(dataOffset, dataOffset + dataLength);
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

function getRandomBuffer(minLength: number = 5, maxLength: number = 15 ) {
  const length = crypto.randomBytes(1)[0] % (maxLength - minLength) + minLength;
  return crypto.randomBytes(length);
}


export default InMemoryStorageLevelDb;
