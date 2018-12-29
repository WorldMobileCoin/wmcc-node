/*!
 * Copyright (c) 2017, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-node
 * attach.js - attach for wmcc_node.
 */

'use strict';

const assert = require('assert');
const Core = require('wmcc-core');
const {Lock} = Core.utils;
const {Amount} = Core.wmcc;

/**
 * Attach for browser event
 * @constructor
 */

function Attach(node) {
  if (!(this instanceof Attach))
    return new Attach(node);

  //this.attach = null; // ? need this
  this.node = node;

  this.events = [];
  this.init();
};

Attach.prototype.init = function init() {
  const self = this;

  // todo: make proper loop
  const d = (tx, view) => {
    let j = self.events['mempool'];
    for (let i in j) {
      self.emit(j[i].event, 'mempool', j[i].el, {tx: tx, view: view});
    }
  };
  const len = this.node.mempool.listeners('tx').filter((event) => {
    return event.toString() === d.toString();
  }).length;
  if (len)
    this.node.mempool.removeListener('tx', d);
  this.node.mempool.on('tx', d);


  const e = async (block, entry) => {
    let k = self.events['chain'];
    for (let i in k) {
      self.emit(k[i].event, 'chain', k[i].el);
    }/*
    const miner = self.node.miner;
    //console.log(miner)
    //console.log('=============== !block ++++++++++++++++')
    if (miner.starting) {
      //console.log('=============== !starting ++++++++++++++++')
      //if (miner.cpu.running && !miner.cpu.stopping) {
      //  console.log('=============== !running ++++++++++++++++')
      //  await miner.cpu.stop();
      //}
      *//*if (miner.cpu.running && !miner.cpu.stopping)
        await miner.cpu.stop();
      else if (miner.cpu.running && miner.cpu.stopping)
        await miner.cpu.wait();
      await miner.cpu.start();*//*
      //if (miner.cpu.job.destroyed)
      if (miner.cpu.running && miner.cpu.stopping)
        await miner.cpu.wait();

      if (!miner.cpu.job.destroyed)
        await miner.cpu.stop();
      
      if (!miner.cpu.running && !miner.cpu.stopping)
        return await miner.cpu.start();

      const tip = self.node.chain.tip;
      return await miner.cpu.createJob(tip, miner.address);
    }*/
    // found!! if (self.node.chain.synced && !self.node.pool.selfish && !self.node.pool.spv)
      // found!! await self.node.broadcast(block); // note: temporary!! find pool event
  };
  const len1 = this.node.chain.listeners('block').filter((event) => {
    return event.toString() === e.toString();
  }).length;
  if (len1)
    this.node.chain.removeListener('block', e);
  this.node.chain.on('block', e);


  const f = () => {
    let l = self.events['balance'];
    for (let i in l) {
      self.emit(l[i].event, 'balance', l[i].el);
    }
  };
  const len2 = this.node.walletdb.listeners('hook balance').filter((event) => {
    return event.toString() === f.toString();
  }).length;
  if (len2)
    this.node.walletdb.removeListener('hook balance', f);
  this.node.walletdb.on('hook balance', f);


  const g = (attempt) => {
    let m = self.events['miner'];
    for (let i in m) {
      self.emit(m[i].event, 'miner', m[i].el, {attempt: attempt});
    }
  };
  const len3 = this.node.miner.listeners('miner block').filter((event) => {
    return event.toString() === g.toString();
  }).length;
  if (len3)
    this.node.miner.removeListener('miner block', g);
  this.node.miner.on('miner block', g);


  const h = async (block, entry) => {
    let n = self.events['notification'];
    for (let i in n) {
      self.emit(n[i].event, 'notification', n[i].el, {block: block, entry: entry, prepend: true});
    }
    // found!! await self.node.broadcast(block); // note: temporary!! find pool event
  };
  const len4 = this.node.miner.listeners('miner found').filter((event) => {
    return event.toString() === h.toString();
  }).length;
  if (len4)
    this.node.miner.removeListener('miner found', h);
  this.node.miner.on('miner found', h);

  this.node.chain.db.on('rescan', () => {
    self.node.walletdb.rescan(0);
  });

  this.node.chain.db.on('block scan', (hash, height) => {
    if (typeof $ === 'undefined')
      return;

    $('preload').show();
    $('preloadcontent').html(`<span class='scanning'>Scanning block ${height}: <a>${hash}</a></span>`);
    if (self.node.chain.tip.height === height)
      $('preload').hide();
  });

  //this.add('minerFoundBlock', 'notification', $('notification'));
};

Attach.prototype.on = async function on(event, module, el, args) {
  if (!this.events[module])
    this.events[module] = [];

  const obj = {event: event, el: el};
  const filter = this.events[module].filter((e,x) => { return (e.event === event || e.el === el)}).length;

  if (!filter)
    this.events[module].push(obj);

  this.events[module] = this.events[module].map(e=>{
    return Object.assign(e, [obj].find(f=>{
        return f && e.event === f.event;
    }));
  });
//console.log(this.events)
  return await this.emit(event, module, el, args);
};

Attach.prototype.add = async function add(event, module, el, args) {
  return await this.on(event, module, el, args);
};
/*Attach.prototype._emit = async function _emit(event, module, el, args) {
  assert(typeof event === 'string');
  assert(typeof module === 'string');
  assert(typeof el === 'object');

  const unlock = await this.locker.lock();
  try {
    return await this._emit(event, module, el, args);
  } finally {
    unlock();
  }
};*/

Attach.prototype.emit = async function emit(event, module, el, args) {
  try {
    let val;
    if (args && Object.keys(args).length)
      val = await this[event](...Object.values(args));
    else
      val = await this[event]();

    if (args && args.append)
      el.append(val);
    else if (args && args.prepend)
      el.prepend(val);
    else
      el.html(val);

    return;
  } catch (e) {
    if (e.name === 'TypeError') console.log(`Unable to attach 'on' event for ${module}::${event}`);
    else throw e;
  }
};

/* Overview - Balance*/
Attach.prototype.getBalance = async function getBalance() {
  //const info = this.info;
  return await this.node.info.wallet.getBalanceDetails(this.node.info.getAccountName());
};

Attach.prototype.getTotal = async function getTotal(value) {
  const amount = (value) ? value : await this.getBalance();
  return Amount.text(amount.total);
};

Attach.prototype.getAvailable = async function getAvailable(value) {
  const amount = (value) ? value : await this.getBalance();
  return Amount.text(amount.available);
};

Attach.prototype.getPending = async function getPending(value) {
  const amount = (value) ? value : await this.getBalance();
  return Amount.text(amount.pending);
};

Attach.prototype.getImmature = async function getImmature(value) {
  const amount = (value) ? value : await this.getBalance();
  return Amount.text(amount.immature);
};

/* Overview - Recent tx*/
/*
Attach.prototype.getRecentTransactions = async function getRecentTransactions() {
  const unlock = await this.locker.lock();
  try {
    return await this._getRecentTransactions();
  } finally {
    unlock();
  }
};*/

Attach.prototype.getRecentTransactions = async function getRecentTransactions() {
  let html = '';
  let txs;
  try {
    txs = await this.node.info.wallet.getLast(this.node.info.wallet.account.name, 5);
  } catch (e) {
    return `<h2>${e}</h2>`;
  }

  for (let tx of txs) {
    tx = await this.node.info.wallet.toDetails(tx);
    const date = new Date(tx.mtime * 1000).format("d-m-Y");
    let value = 0;
    let type = null;
    for (let input of tx.inputs) {
      if (input.path)
        value += input.value, type = 'out';
      if (tx.time === 0)
        type = 'out sending';
    }
    if (!value) {
      for (let output of tx.outputs)
        if (output.path)
          value += output.value, type = 'in';
        if (tx.time === 0)
          type = 'in receiving';
        if (tx.tx.isCoinbase())
          type = 'rig';
    } else {
      value = 0;
      for (let output of tx.outputs)
        if (!output.path)
          value += output.value, type = 'out';
    }
    html += `<holder><i class="glyph-icon flaticon-${type}"></i><span>`;
    html += `<label>${date}</label><label>${Amount.wmcc(value, true)} wmcc</label>`;
    html += `<a><label class='r_goToExp' value="${tx.hash}">Show Details</label></a></span></holder>`;
  }

  if (!html)
    return `<holder><h2>No recent transaction found.</h2></holder>`;

  return html;
};

/* Overview - Mempool*/
Attach.prototype.getUnconfirmTxCount = function getUnconfirmTxCount() {
  return this.node.mempool.getCount();
};

Attach.prototype.getUnconfirmTxSize = function getUnconfirmTxSize() {
  const size = this.node.mempool.getSize();
  return bytesToKilo(size);
};

Attach.prototype.getLatestTxs = function getLatestTxs(tx, view) {
  let html = '';
  if (tx) {
    const incoming = [tx.hash('hex'), tx.getOutputValue()];
    if (this._latesttxs.indexOf(incoming))
      this._latesttxs.push(incoming);
    else
      return;
  } else {
    this._latesttxs = [];
    this.node.mempool.map.forEach((value, hash) => {
      this._latesttxs.push([hash, value.value]);
    });
  }
  const pos = this._latesttxs.length;
  const txs = this._latesttxs.slice(Math.max(0, pos - 5), pos);

  if (txs.length){
    html += `<table>`;
    for (let i=txs.length-1; i>=0; i--) {
      html += `<tr><td><a title='${txs[i][0]}' class='r_goToExp'>${txs[i][0]}<a></td>`;
      html += `<td>${Amount.wmcc(txs[i][1], true)}</td></tr>`;
    }
    html += `</table>`;
  } else
    html = `<h2>No transaction in mempool.</h2>`;

  return html;
};

/* Overview - Block */
Attach.prototype.getCurrentBlock = async function getCurrentBlock() {
  let html = '';

  const height = this.node.chain.height;
  const tip = this.node.chain.tip.rhash();
  const entry = await this.node.chain.getEntry(height);
  const block = await this.node.chain.getBlock(entry.hash);
  const hash = entry.rhash();

  html += `<table>`;
  html += `<tr><td>Tip</td><td colspan='3'><a title='${tip}'>${tip}</a></td></tr>`;
  html += `<tr><td>Hash</td><td colspan='3'><a title='${hash}' class='r_goToExp'>${hash}</a></td></tr>`;
  html += `<tr><td>Height</td><td>${height}</td>`;
  html += `<td>Age</td><td class='timeAge' value='${entry.time}' k='1'>${age(entry.time)}</td></tr>`;
  html += `<tr><td>Txns<a></td><td>${block.txs.length}</td>`;
  html += `<td>Outputs</td><td>${Amount.wmcc(block.getClaimed())} wmcc</td></tr>`;
  html += `<tr><td>Size</td><td>${block.getVirtualSize()/1000} kb</td>`;
  html += `<td>Weight</td><td>${block.getWeight()/1000} kwu</td></tr>`;

  return html;
};

Attach.prototype.destroy = async function destroy() {
  ;//this.events = [];
}
/* Overview - Miner*/

Attach.prototype.getMinerInfo = function getMinerInfo(attempt) {
  if (this._getMinerInfo && !attempt)
    attempt = this._getMinerInfo;
  let html = '<table>';
  if (attempt) {
    this._getMinerInfo = attempt;
    html += `<tr><td>Address</td><td colspan="3"><a title='${attempt.address}' class='r_goToExp'>${attempt.address}</a></td></tr>`;
    html += `<tr><td>Height</td><td>${attempt.height}</td><td>Fees</td><td>${Amount.wmcc(attempt.fees)} wmcc</td></tr>`;
    html += `<tr><td>Transactions</td><td>${attempt.items.length + 1}</td><td>Difficulty</td><td>${toDifficulty(attempt.bits)}</td></tr>`;
  } else {
    html += `<tr><td colspan="2" class="ellipse">Address: ${this.node.info.getAddress()}</td></tr>`;
  }
  html += `<table>`;
  return html;
};

Attach.prototype.minerFoundBlock = function minerFoundBlock(block, entry) {
  if (typeof block !== "object") return;
  let html = '';
  html += `<table class='minerfound'><tr><th rowspan="3"><i class="glyph-icon flaticon-remove"></i><i class="glyph-icon flaticon-rig"></i></th>`;
  html += `<th colspan="2">Found New Block!</th></tr>`;
  html += `<tr><td>Block height</td><td>: ${entry.height}</td></tr>`;
  html += `<tr><td>Block reward</td><td>: ${Amount.wmcc(block.txs[0].outputs[0].value)} wmcc</td></tr></table>`;
  return html;
};

/**
 * Helper
 */
/*function filter(f, e, l) {
  return f.listeners(l).filter((event) => {
    return event.toString() === e.toString();
  }).length;
}*/

function toDifficulty(bits) {
  let shift = (bits >>> 24) & 0xff;
  let diff = 0x0000ffff / (bits & 0x00ffffff);

  while (shift < 29) {
    diff *= 256.0;
    shift++;
  }

  while (shift > 29) {
    diff /= 256.0;
    shift--;
  }

  return diff.toFixed(12);
}

function bytesToKilo(bytes) {
    if(bytes < 1048576) return(bytes / 1024).toFixed(3);
    else if(bytes < 1073741824) return(bytes / 1024).toFixed(0);
}

function age(time, bool) {
  let d = bool ? time : Math.abs(Date.now()/1000 - time);
  let o = '';
  let r = {};
  let c = 0;
  const s = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1
  }

  Object.keys(s).forEach(function(i){
    r[i] = Math.floor(d / s[i]);
    d -= r[i] * s[i];
    if (r[i] && c<1) {
      c++;
      o += ` ${r[i]} ${i}${r[i] > 1 ? 's':''}`;
    }
  });
  return `${o}${bool ? '':' ago'}`;
}

module.exports = Attach;