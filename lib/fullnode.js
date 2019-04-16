/*!
 * Copyright (c) 2018, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-desktop
 */
'use strict';

const {
  blockchain,
  http,
  mining,
  net,
  stratum,
  txmempool,
  wallet
} = require('wmcc-core');
const {Auth} = require('wmcc-credential');
//--
const {Chain} = blockchain;
const {RPC, Server} = http;
const {Miner} = mining;
const {Pool} = net;
const {Stratum} = stratum;
const {Fees, Mempool} = txmempool;
const {WalletDB} = wallet;
//--
const Node = require('./node');
const NodeClient = require('./nodeclient');

/**
 * @module wmcc-node.Fullnode
 * @extends wmcc-node.Node
 */
class FullNode extends Node {
  constructor(options) {
    super(options);

    this.spv = false;
    this.prefix = this.config.prefix;

    this.chain = new Chain({
      network: this.network,
      logger: this.logger,
      workers: this.workers,
      db: this.config.str('db'),
      prefix: this.config.prefix,
      maxFiles: this.config.uint('max-files'),
      cacheSize: this.config.mb('cache-size'),
      forceFlags: this.config.bool('force-flags'),
      bip91: this.config.bool('bip91'),
      bip148: this.config.bool('bip148'),
      prune: this.config.bool('prune'),
      checkpoints: this.config.bool('checkpoints'),
      coinCache: this.config.mb('coin-cache'),
      entryCache: this.config.uint('entry-cache'),
      indexTX: this.config.bool('index-tx'),
      indexAddress: this.config.bool('index-address'),
      blockNotify: this.config.str('block-notify'),
      subscribeCmd: this.config.str('subscribe-cmd')
    });

    this.fees = new Fees(this.logger);
    this.fees.init();

    this.mempool = new Mempool({
      network: this.network,
      logger: this.logger,
      workers: this.workers,
      chain: this.chain,
      fees: this.fees,
      db: this.config.str('db'),
      prefix: this.config.prefix,
      persistent: this.config.bool('persistent-mempool'),
      maxSize: this.config.mb('mempool-size'),
      limitFree: this.config.bool('limit-free'),
      limitFreeRelay: this.config.uint('limit-free-relay'),
      requireStandard: this.config.bool('require-standard'),
      rejectAbsurdFees: this.config.bool('reject-absurd-fees'),
      replaceByFee: this.config.bool('replace-by-fee'),
      indexAddress: this.config.bool('index-address')
    });

    this.pool = new Pool({
      network: this.network,
      logger: this.logger,
      chain: this.chain,
      mempool: this.mempool,
      prefix: this.config.prefix,
      selfish: this.config.bool('selfish'),
      compact: this.config.bool('compact'),
      bip37: this.config.bool('bip37'),
      bip151: this.config.bool('bip151'),
      bip150: this.config.bool('bip150'),
      identityKey: this.config.buf('identity-key'),
      maxOutbound: this.config.uint('max-outbound'),
      maxInbound: this.config.uint('max-inbound'),
      proxy: this.config.str('proxy'),
      onion: this.config.bool('onion'),
      upnp: this.config.bool('upnp'),
      seeds: this.config.array('seeds'),
      nodes: this.config.array('nodes'),
      only: this.config.array('only'),
      publicHost: this.config.str('public-host'),
      publicPort: this.config.uint('public-port'),
      host: this.config.str('host'),
      port: this.config.uint('port'),
      listen: this.config.bool('listen'),
      persistent: this.config.bool('persistent')
    });

    this.miner = new Miner({
      network: this.network,
      logger: this.logger,
      workers: this.workers,
      chain: this.chain,
      mempool: this.mempool,
      address: this.config.array('coinbase-address'),
      coinbaseFlags: this.config.str('coinbase-flags'),
      preverify: this.config.bool('preverify'),
      maxWeight: this.config.uint('max-weight'),
      reservedWeight: this.config.uint('reserved-weight'),
      reservedSigops: this.config.uint('reserved-sigops')
    });

    this.rpc = new RPC(this);

    if (!Server.unsupported) {
      this.http = new Server({
        network: this.network,
        logger: this.logger,
        node: this,
        prefix: this.config.prefix,
        ssl: this.config.bool('ssl'),
        keyFile: this.config.path('ssl-key'),
        certFile: this.config.path('ssl-cert'),
        host: this.config.str('http-host'),
        port: this.config.uint('http-port'),
        apiKey: this.config.str('api-key'),
        noAuth: this.config.bool('no-auth')
      });
    }

    this.client = new NodeClient(this);

    this.walletdb = new WalletDB({
      network: this.network,
      logger: this.logger,
      workers: this.workers,
      client: this.client,
      prefix: this.config.prefix,
      db: this.config.str(['wallet-db', 'db']),
      maxFiles: this.config.uint('wallet-max-files'),
      cacheSize: this.config.mb('wallet-cache-size'),
      witness: this.config.bool('wallet-witness'),
      checkpoints: this.config.bool('wallet-checkpoints'),
      startHeight: this.config.uint('wallet-start-height'),
      wipeNoReally: this.config.bool('wallet-wipe-no-really'),
      apiKey: this.config.str(['wallet-api-key', 'api-key']),
      walletAuth: this.config.bool('wallet-auth'),
      noAuth: this.config.bool(['wallet-no-auth', 'no-auth']),
      ssl: this.config.str('wallet-ssl'),
      host: this.config.str('wallet-host'),
      port: this.config.uint('wallet-port'),
      spv: this.spv,
      verify: this.spv,
      listen: false
    });

    this.stratum = new Stratum({
      node: this,
      prefix: this.config.prefix,
      logger: this.logger,
      host: this.config.str('stratum-host'),
      port: this.config.uint('stratum-port'),
      publicHost: this.config.str('stratum-public-host'),
      publicPort: this.config.uint('stratum-public-port'),
      maxInbound: this.config.uint('stratum-max-inbound'),
      difficulty: this.config.uint('stratum-difficulty'),
      dynamic: this.config.bool('stratum-dynamic'),
      password: this.config.str('stratum-password')
    });

    this.auth = new Auth({
      network: this.network,
      logger: this.logger,
      walletdb: this.walletdb,
      chain: this.chain,
      otp: this.config.bool('auth-otp'),
      alg: this.config.str('hsm-alg'),
      hash: this.config.str('hsm-hash'),
      iter: this.config.str('hsm-iter'),
      r: this.config.str('hsm-r'),
      p: this.config.str('hsm-p'),
      length: this.config.str('hsm-length')
    });

    if (this.http && this.walletdb.http)
      this.walletdb.http.attach(this.http);

    this.walletdb.rpc.attach(this.rpc);

    this._init();
  }

  _init() {
    // Bind to errors
    this.chain.on('error', err => this.error(err));
    this.mempool.on('error', err => this.error(err));
    this.pool.on('error', err => this.error(err));
    this.miner.on('error', err => this.error(err));
    this.walletdb.on('error', err => this.error(err));
    this.stratum.on('error', err => this.error(err));

    if (this.http)
      this.http.on('error', err => this.error(err));

    this.mempool.on('tx', (tx) => {
      this.miner.cpu.notifyEntry();
      this.emit('tx', tx);
    });

    this.chain.hook('connect', async (entry, block) => {
      try {
        await this.mempool._addBlock(entry, block.txs);
      } catch (e) {
        this.error(e);
      }
      this.emit('block', block);
      this.emit('connect', entry, block);
    });

    this.chain.hook('disconnect', async (entry, block) => {
      try {
        await this.mempool._removeBlock(entry, block.txs);
      } catch (e) {
        this.error(e);
      }
      this.emit('disconnect', entry, block);
    });

    this.chain.hook('reorganize', async (tip, competitor) => {
      try {
        await this.mempool._handleReorg();
      } catch (e) {
        this.error(e);
      }
      this.emit('reorganize', tip, competitor);
    });

    this.chain.hook('reset', async (tip) => {
      try {
        await this.mempool._reset();
      } catch (e) {
        this.error(e);
      }
      this.emit('reset', tip);
    });

    // todo: load stratum event

    this.loadPlugins();
  }

  async _open() {
    await this.chain.open();
    await this.mempool.open();
    await this.miner.open();
    await this.pool.open();
    await this.walletdb.open();
    await this.stratum.open();

    await this.openPlugins();

    if (this.http)
      await this.http.open();

    this.logger.info('Node is loaded.');
  }

  async _close() {
    if (this.http)
      await this.http.close();

    await this.closePlugins();

    await this.stratum.close();
    await this.walletdb.close();
    await this.pool.close();
    await this.miner.close();
    await this.mempool.close();
    await this.chain.close();

    this.logger.info('Node is closed.');
  }

  /**
  * @returns {Promise}
  */
  scan(start, filter, iter) {
    return this.chain.scan(start, filter, iter);
  }

  async broadcast(item) {
    try {
      await this.pool.broadcast(item);
    } catch (e) {
      this.emit('error', e);
    }
  }

  async sendTX(tx) {
    let missing;

    try {
      missing = await this.mempool.addTX(tx);
    } catch (err) {
      if (err.type === 'VerifyError' && err.score === 0) {
        this.error(err);
        this.logger.warning('Verification failed for tx: %s.', tx.txid());
        this.logger.warning('Attempting to broadcast anyway...');
        this.broadcast(tx);
        return;
      }
      throw err;
    }

    if (missing) {
      this.logger.warning('TX was orphaned in mempool: %s.', tx.txid());
      this.logger.warning('Attempting to broadcast anyway...');
      this.broadcast(tx);
      return;
    }

    // We need to announce by hand if
    // we're running in selfish mode.
    if (this.pool.options.selfish)
      this.pool.broadcast(tx);
  }

  async relay(tx) {
    try {
      await this.sendTX(tx);
    } catch (e) {
      this.error(e);
    }
  }

  connect() {
    return this.pool.connect();
  }

  disconnect() {
    return this.pool.disconnect();
  }

  startSync() {
    return this.pool.startSync();
  }

  stopSync() {
    return this.pool.stopSync();
  }

  getBlock(hash) {
    return this.chain.getBlock(hash);
  }

  async getCoin(hash, index) {
    const coin = this.mempool.getCoin(hash, index);

    if (coin)
      return coin;

    if (this.mempool.isSpent(hash, index))
      return null;

    return await this.chain.getCoin(hash, index);
  }

  async getCoinsByAddress(addrs, after) {
    const mempool = this.mempool.getCoinsByAddress(addrs);
    const chain = await this.chain.getCoinsByAddress(addrs, after);
    const out = [];

    for (const coin of chain) {
      const spent = this.mempool.isSpent(coin.hash, coin.index);

      if (spent)
        continue;

      out.push(coin);
    }

    for (const coin of mempool)
      out.push(coin);

    return out;
  }

  async getMetaByAddress(addrs) {
    const mempool = this.mempool.getMetaByAddress(addrs);
    const chain = await this.chain.getMetaByAddress(addrs);
    return chain.concat(mempool);
  }

  async getMeta(hash) {
    const meta = this.mempool.getMeta(hash);

    if (meta)
      return meta;

    return await this.chain.getMeta(hash);
  }

  /**
  * @returns {Promise}
  */
  getMetaView(meta) {
    if (meta.height === -1)
      return this.mempool.getSpentView(meta.tx);
    return this.chain.getSpentView(meta.tx);
  }

  async getTXByAddress(addrs) {
    const mtxs = await this.getMetaByAddress(addrs);
    const out = [];

    for (const mtx of mtxs)
      out.push(mtx.tx);

    return out;
  }

  async getTX(hash) {
    const mtx = await this.getMeta(hash);

    if (!mtx)
      return null;

    return mtx.tx;
  }

  async hasTX(hash) {
    if (this.mempool.hasEntry(hash))
      return true;

    return await this.chain.hasTX(hash);
  }
}

/*
 * Expose
 */
module.exports = FullNode;