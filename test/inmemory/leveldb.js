import crypto from 'crypto';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import fs from 'fs';
import InMemoryStorageLevelDb, { splitBuffer } from '../../lib/inmemory/inmemory_leveldb';

chai.use(chaiAsPromised);

describe('testing inmemory with leveldb', () => {

  const dbPath = './testdb';
  const { publicKey, privateKey } = generateKeyPair();

  after(() => {
    cleanDb(dbPath);
  });

  describe('restoring encrypted values', () => {
    let db;
    before(() => {
      cleanDb(dbPath);
      db = new InMemoryStorageLevelDb({
        publicKey,
        path: dbPath,
        modulusLength: 1024,
      });
    });

    it('restoring encrypted values', async () => {
      const aLongString = crypto.randomBytes(10000).toString();
      db.put('key', aLongString);
      await db.flush();
      const encrypted = await db.getStored('key');
      const restored = Buffer.concat(
        splitBuffer(encrypted, db.RSA_SIZE).map(b => {
          return crypto.privateDecrypt({
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          }, b);
        })
      );

      expect(aLongString).to.equal(restored.toString());

    });
    after(async () => {
      await db.close();
      cleanDb(dbPath);
    });
  });

  describe('test putting and getting from store', () => {

    const testKey = 'key';
    const testValue = 'value';
    const notStoredKey = 'not_stored_key';
    const notStoredValue = 'not_stored_value';

    let db;

    before(() => {
      cleanDb(dbPath);
    });

    beforeEach(() => {
      db = new InMemoryStorageLevelDb({
        publicKey,
        path: dbPath,
        modulusLength: 1024,
      });
    });

    afterEach(async () => {
      await db.close();
    });


    it('put value in memory', async () => {
      expect(db.get(testKey)).to.equal(undefined);

      db.put(testKey, testValue);
      const value = db.get(testKey);
      let hasStored = await db.hasStored(testKey);
      expect(hasStored).to.be.false;
      expect(value).to.equal(testValue);

      await db.flush();

      hasStored = await db.hasStored(testKey);
      expect(hasStored).to.be.true;
    });

    it('has value in store but not in memory', async () => {
      const value = db.get(testKey);
      expect(value).to.equal(undefined);

      const hasValue = await db.hasStored(testKey);
      expect(hasValue).to.be.true;
    });

    it('restoring value', async () => {
      const signedData = signHash(testValue, privateKey);

      await db.restore(testKey, testValue, signedData);

      const value = db.get(testKey);
      expect(value).to.equal(testValue);
    });

    it('restoring value that is in memory', async () => {
      db.put
      const signedData = signHash(notStoredValue, privateKey);

      await expect(db.restore(notStoredKey, notStoredValue, signedData))
        .to.be.rejectedWith(Error, 'no such value');

    });

    it('restoring value that not stored', async () => {
      const signedData = signHash(notStoredValue, privateKey);

      await expect(db.restore(notStoredKey, notStoredValue, signedData))
        .to.be.rejectedWith(Error, 'no such value');

    });
    it('restoring value with invalid signature', async () => {
      const signedData = signHash(notStoredValue, privateKey);

      await expect(db.restore(testKey, testValue, signedData))
        .to.be.rejectedWith(Error, 'invalid signature');
    });

    it('getting stored value', async () => {
      const encrypted = await db.getStored(testKey);
      const value = crypto.privateDecrypt(privateKey, encrypted).toString('utf8');
      expect(value).to.equal(testValue);
    });

  });

  describe('test getting ciphered keys', () => {

    let db;

    describe('getting encrypted pairs when in memory', async () => {

      before(async () => {
        cleanDb(dbPath);
        db = new InMemoryStorageLevelDb({
          publicKey,
          path: dbPath,
          modulusLength: 1024,
        });
        db.put('key1', 'value1');
        db.put('key2', 'value2');
      });

      after(async () => {
        await db.close();
      });

      it('', async () => {
        let encryptedPairs = await db.getEncrypted();
        expect(encryptedPairs.size).to.equal(0);
        await db.flush();

        encryptedPairs = await db.getEncrypted();
        expect(encryptedPairs.size).to.equal(0);
      });

    });

    describe('getting encrypted pairs when not in memory', async () => {

      before(async () => {
        cleanDb(dbPath);
        db = new InMemoryStorageLevelDb({
          publicKey,
          modulusLength: 1024,
          path: dbPath,
        });
        db.put('key1', 'value1');
        db.put('key2', 'value2');
        await db.flush();
        await db.close();
        db = new InMemoryStorageLevelDb({
          publicKey,
          modulusLength: 1024,
          path: dbPath,
        });
      });

      it('', async () => {
        const encryptedPairs = await db.getEncrypted();
        expect(encryptedPairs.size).to.equal(2);
        expect(encryptedPairs.has('key1')).to.be.true;
        expect(encryptedPairs.has('key2')).to.be.true;
      });

      after(async () => {
        await db.close();
      });


    });

  });

});


function generateKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 1024,
    publicKeyEncoding: {
      type: 'pkcs1',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs1',
      format: 'pem',
    },
  });
}

function signHash(value, privateKey) {
  const hash = crypto.createHash('sha256').update(value).digest('hex');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(hash);
  return sign.sign(privateKey, 'hex');
}

function cleanDb(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(p => {
      fs.unlinkSync(`${path}/${p}`);
    });
    fs.rmdirSync(path);
  }
}
