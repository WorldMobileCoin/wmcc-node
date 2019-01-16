/*!
 * Copyright (c) 2018, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-desktop
 */
'use strict';

const Assert = require('assert');
//--
const Logger = require('wmcc-logger');
const Core = require('wmcc-core')
const {
  crypto,
  native,
  protocol,
  utils,
  workers
} = Core;
//--
const {secp256k1} = crypto;
const {Network} = protocol;
const {AsyncObject, util} = utils;
const {WorkerPool} = workers;
//--
const Config = require('./config');

/**
 * @module wmcc-node.Node
 * @extends wmcc-core.AsyncObject
 */
class Node extends AsyncObject {
  constructor(options) {
    super();

    this.config = new Config('wmcc');
    this.config.inject(options);
    this.config.load(options);

    if (options.config)
      this.config.open('wmcc.conf');

    this.network = Network.get(this.config.network);
    this.startTime = -1;
    this.bound = [];
    this.plugins = Object.create(null);
    this.stack = [];

    this.logger = null;
    this.workers = null;

    this.spv = false;
    this.chain = null;
    this.fees = null;
    this.mempool = null;
    this.pool = null;
    this.miner = null;
    this.http = null;
    this.wallet = null;
    this.stratum = null;

    this.init();
  }

  init() {
    this.initOptions();

    this.on('error', () => {});

    this.workers.on('spawn', (child) => {
      this.logger.info('Spawning worker process: %d.', child.id);
    });

    this.workers.on('exit', (code, child) => {
      this.logger.warning('Worker %d exited: %s.', child.id, code);
    });

    this.workers.on('log', (text, child) => {
      this.logger.debug('Worker %d says:', child.id);
      this.logger.debug(text);
    });

    this.workers.on('error', (err, child) => {
      if (child) {
        this.logger.error('Worker %d error: %s', child.id, err.message);
        return;
      }
      this.emit('error', err);
    });

    this.hook('preopen', () => this.handlePreopen());
    this.hook('preclose', () => this.handlePreclose());
    this.hook('open', () => this.handleOpen());
    this.hook('close', () => this.handleClose());
  }

  initOptions() {
    let logger = new Logger();
    const config = this.config;

    if (config.has('logger'))
      logger = config.obj('logger');

    logger.set({
      filename: config.bool('log-file')
        ? config.location('debug.log')
        : null,
      level: config.str('log-level'),
      console: config.bool('log-console'),
      browser: config.bool('log-browser'),
      shrink: config.bool('log-shrink')
    });

    this.logger = logger.context('node');

    this.workers = new WorkerPool({
      enabled: config.bool('workers'),
      size: config.uint('workers-size'),
      timeout: config.uint('workers-timeout'),
      file: config.str('worker-file')
    });
  }

  /**
   * @returns {Promise}
   */
  ensure() {
    return this.config.ensure();
  }

  location(name) {
    return this.config.location(name);
  }

  async handlePreopen() {
    await this.logger.open();
    await this.workers.open();

    this.bind(this.network.time, 'offset', (offset) => {
      this.logger.info('Time offset: %d (%d minutes).', offset, offset / 60 | 0);
    });

    this.bind(this.network.time, 'sample', (sample, total) => {
      this.logger.debug(
        'Added time data: samples=%d, offset=%d (%d minutes).',
        total, sample, sample / 60 | 0);
    });

    this.bind(this.network.time, 'mismatch', () => {
      this.logger.warning('Adjusted time mismatch!');
      this.logger.warning('Please make sure your system clock is correct!');
    });
  }

  handleOpen() {
    this.startTime = util.now();

    if (!secp256k1.binding) {
      this.logger.warning('Warning: secp256k1-node was not built.');
      this.logger.warning('Verification will be slow.');
    }

    if (!native.binding) {
      this.logger.warning('Warning: wmcc-native was not built.');
      this.logger.warning('Hashing will be slow.');
    }

    if (!this.workers.enabled) {
      this.logger.warning('Warning: worker pool is disabled.');
      this.logger.warning('Verification will be slow.');
    }
  }

  handlePreclose() {
    ;
  }

  async handleClose() {
    for (const [obj, event, listener] of this.bound)
      obj.removeListener(event, listener);

    this.bound.length = 0;
    this.startTime = -1;

    await this.workers.close();
    await this.logger.close();
  }

  bind(obj, event, listener) {
    this.bound.push([obj, event, listener]);
    obj.on(event, listener);
  }

  error(err) {
    this.logger.error(err);
    this.emit('error', err);
  }

  uptime() {
    if (this.startTime === -1)
      return 0;

    return util.now() - this.startTime;
  }

  use(plugin) {
    Assert(plugin, 'Plugin must be an object.');
    Assert(typeof plugin.init === 'function', '`init` must be a function.');

    Assert(!this.loaded, 'Cannot add plugin after node is loaded.');

    const instance = plugin.init(this, Core);

    Assert(!instance.open || typeof instance.open === 'function',
      '`open` must be a function.');
    Assert(!instance.close || typeof instance.close === 'function',
      '`close` must be a function.');

    if (plugin.id) {
      Assert(typeof plugin.id === 'string', '`id` must be a string.');

      // Reserved names
      switch (plugin.id) {
        case 'chain':
        case 'fees':
        case 'mempool':
        case 'miner':
        case 'pool':
        case 'rpc':
        case 'http':
        case 'wallet':
        case 'stratum':
          Assert(false, `${plugin.id} is already added.`);
          break;
      }

      Assert(!this.plugins[plugin.id], `${plugin.id} is already added.`);

      this.plugins[plugin.id] = instance;
    }

    this.stack.push(instance);

    if (typeof instance.on === 'function')
      instance.on('error', err => this.error(err));

    return instance;
  }

  has(name) {
    return this.plugins[name] != null;
  }

  get(name) {
    Assert(typeof name === 'string', 'Plugin name must be a string.');

    // Reserved names.
    switch (name) {
      case 'chain':
        Assert(this.chain, 'chain is not loaded.');
        return this.chain;
      case 'fees':
        Assert(this.fees, 'fees is not loaded.');
        return this.fees;
      case 'mempool':
        Assert(this.mempool, 'mempool is not loaded.');
        return this.mempool;
      case 'miner':
        Assert(this.miner, 'miner is not loaded.');
        return this.miner;
      case 'pool':
        Assert(this.pool, 'pool is not loaded.');
        return this.pool;
      case 'rpc':
        Assert(this.rpc, 'rpc is not loaded.');
        return this.rpc;
      case 'http':
        Assert(this.http, 'http is not loaded.');
        return this.http;
      case 'wallet':
        Assert(this.wallet, 'wallet is not loaded.');
        return this.wallet;
      case 'stratum':
        Assert(this.stratum, 'stratum is not loaded.');
        return this.stratum;
    }

    return this.plugins[name] || null;
  }

  require(name) {
    const plugin = this.get(name);
    Assert(plugin, `${name} is not loaded.`);
    return plugin;
  }

  loadPlugins() {
    const plugins = this.config.array('plugins', []);
    const loader = this.config.func('loader');

    for (let plugin of plugins) {
      if (typeof plugin === 'string') {
        Assert(loader, 'Must pass a loader function.');
        plugin = loader(plugin);
      }
      this.use(plugin);
    }
  }

  async openPlugins() {
    for (const plugin of this.stack) {
      if (plugin.open)
        await plugin.open();
    }
  }

  async closePlugins() {
    for (const plugin of this.stack) {
      if (plugin.close)
        await plugin.close();
    }
  }
}

/*
 * Expose
 */
module.exports = Node;