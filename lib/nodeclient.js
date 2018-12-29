/*!
 * Copyright (c) 2018, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-desktop
 */
'use strict';

/**
 * @module wmcc-node.NodeClient
 * @extends wmcc-core.AsyncObject
 */
const {AsyncObject} = require('wmcc-core').utils;

class NodeClient extends AsyncObject {
  constructor(node) {
    super();

    this.node = node;
    this.network = node.network;
    this.filter = null;
    this.listen = false;

    this._init();
  }

  _init() {
    this.node.on('connect', (entry, block) => {
      if (!this.listen)
        return;

      this.emit('block connect', entry, block.txs);
    });

    this.node.on('disconnect', (entry, block) => {
      if (!this.listen)
        return;

      this.emit('block disconnect', entry);
    });

    this.node.on('tx', (tx) => {
      if (!this.listen)
        return;

      this.emit('tx', tx);
    });

    this.node.on('reset', (tip) => {
      if (!this.listen)
        return;

      this.emit('chain reset', tip);
    });
  }

  _open() {
    this.listen = true;
  }

  _close() {
    this.listen = false;
  }

  getTip() {
    return this.node.chain.tip;
  }

  async getEntry(hash) {
    const entry = await this.node.chain.getEntry(hash);

    if (!entry)
      return null;

    if (!await this.node.chain.isMainChain(entry))
      return null;

    return entry;
  }

  async send(tx) {
    await this.node.relay(tx);
  }

  setFilter(filter) {
    this.filter = filter;
    this.node.pool.setFilter(filter);
  }

  addFilter(data) {
    this.node.pool.queueFilterLoad();
  }

  resetFilter() {
    this.node.pool.queueFilterLoad();
  }

  estimateFee(blocks) {
    if (!this.node.fees)
      return this.network.feeRate;

    return this.node.fees.estimateFee(blocks);
  }

  rescan(start) {
    return this.node.chain.scan(start, this.filter, (entry, txs) => {
      return this.fire('block rescan', entry, txs);
    });
  }
}

/**
 * Expose
 */
module.exports = NodeClient;