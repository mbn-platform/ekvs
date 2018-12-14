import fs from 'fs';
import crypto from 'crypto';
import chai, { expect } from 'chai';
import InMemoryStorageLevelDb from '../../lib/inmemory/inmemory_leveldb';
import { ReplicaNode } from '../../lib/chain_replication/ReplicaNode';
import { RemoteReplicaNode } from '../../lib/chain_replication/remote/RemoteReplicaNode';
import { WebSocketTrasport, WebServerTransport } from '../../lib/chain_replication/remote/transport/WebSocket';

describe.only('testing single replica node', () => {

  const dbPath1 = './testdb1';
  const dbPath2 = './testdb2';
  const dbPath3 = './testdb3';

  const { publicKey, privateKey } = generateKeyPair();
  let head, middle, tail;

  before(async () => {
    cleanDb(dbPath1);
    cleanDb(dbPath2);
    cleanDb(dbPath3);
    const db1 = new InMemoryStorageLevelDb({
      publicKey,
      path: dbPath1,
      modulusLength: 1024,
    });
    const db2 = new InMemoryStorageLevelDb({
      publicKey,
      path: dbPath2,
      modulusLength: 1024,
    });
    const db3 = new InMemoryStorageLevelDb({
      publicKey,
      path: dbPath3,
      modulusLength: 1024,
    });
    head = new ReplicaNode(db1, 'head');
    middle = new ReplicaNode(db2, 'middle');
    tail = new ReplicaNode(db3, 'tail');
    tail.setPrevious(new RemoteReplicaNode(tail, new WebServerTransport(8001)));
    middle.setPrevious(new RemoteReplicaNode(middle, new WebServerTransport(8002)));
    head.setNext(new RemoteReplicaNode(head, new WebSocketTrasport('ws://localhost:8002')));
    middle.setNext(new RemoteReplicaNode(middle, new WebSocketTrasport('ws://localhost:8001')));
    await new Promise(res => setTimeout(res, 1000));
  });

  it('', () => {
  });

  it('testing putting and getting values', async () => {
    head.handleRequest({
      type:0,
      id: 'firstupdate',
      key: 'test',
      value: 'value',
    });
    tail.handleRequest({
      type: 1,
      id: 'firstquery',
      key: 'test',
    });
    head.handleRequest({
      type:0,
      id: 'secondupdate',
      key: 'test1',
      value: 'value1',
    });
    head.handleRequest({
      type:0,
      id: 'thirdupdaterewrite',
      key: 'test',
      value: 'updatedvalue',
    });
    tail.handleRequest({
      type: 1,
      id: 'secondquery',
      key: 'test',
    });
    await new Promise(res => setTimeout(res, 1000));
    tail.handleRequest({
      type: 1,
      id: 'secondquery',
      key: 'test',
    });
    console.log(head.stat());
    console.log(middle.stat());
    console.log(tail.stat());

  });

  after(() => {
    cleanDb(dbPath1);
    cleanDb(dbPath2);
    cleanDb(dbPath3);
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
function cleanDb(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(p => {
      fs.unlinkSync(`${path}/${p}`);
    });
    fs.rmdirSync(path);
  }
}
