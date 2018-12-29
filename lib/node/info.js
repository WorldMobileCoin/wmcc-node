/*!
 * Copyright (c) 2014-2015, Fedor Indutny
 * Copyright (c) 2014-2017, Christopher Jeffrey
 * Copyright (c) 2017, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-node
 * info.js - info for wmcc_node.
 */

'use strict';

const Core = require('wmcc-core');
const {Address} = Core.primitives;
const {Account} = Core.wallet;
const {Amount} = Core.wmcc;
const {encoding, util} = Core.utils;
const {consensus, policy} = Core.protocol;

/**
 * Info (static) for browser
 * @constructor
 */

function Info(node) {
  if (!(this instanceof Info))
    return new Info(node);

  this.info = null; // ? need this
  this.node = node;

  this.wallet = node.wallet || null;
  this.account = node.wallet ? node.wallet.account : null;

  this.explorer = {
    isHome: true
  };
};

Info.prototype.getWalletID = function getWalletID() {
  return this.wallet.id;
};

Info.prototype.getAccounts = function getAccounts() {
  return this.wallet.getAccounts();
};

Info.prototype.getAccount = function getAccount() {
  return this.wallet.account;
};

Info.prototype.getAccountName = function getAccountName() {
  return this.wallet.account.name;
};

Info.prototype.getTempReceive = function getTempReceive() {
  return this.wallet.getTempReceive().toString();
};

Info.prototype.createReceive = async function createReceive() {
  const account = await this.getAccountName();
  const acc = await this.wallet.createReceive(account);
  return this.getTempReceive();
};

Info.prototype.estimateFee = async function estimateFee() {
  let fee = await this.node.walletdb.estimateFee();
 // if (fee === 0) fee = this.fees.minTrackedFee;
  return Amount.wmcc(fee);
};

Info.prototype.estimatePri = async function estimatePri() {
  let pri = await this.node.fees.estimatePriority();
  if (pri === 0) pri = this.node.fees.minTrackedPri;
  return Amount.wmcc(pri);
};

/* MINER */
Info.prototype.isMinerStarted = function isMinerStarted() {
  return this.node.miner.cpu.running;
};

Info.prototype.startMining = async function startMining() {
  try {
    return await this.node.miner.cpu.start();
  } catch (e) {;}
};

Info.prototype.stopMining = async function stopMining() {
  try {
    return await this.node.miner.cpu.stop();
  } catch (e) {
    this.node.miner.reset(false);
  }
};

Info.prototype.getAddress = function getAddress() {
  return this.node.miner.getAddress().toString();
};

/* Wallet */
Info.prototype.getWalletInfo = async function getWalletInfo() {
  let html = '';

  const details = this.wallet.toJSON(true);
  html += `<holder><i class="glyph-icon flaticon-wallets"></i><span>${details.id} <a>Wallet Name</a></span></holder>`;
  html += `<holder><i class="glyph-icon flaticon-id"></i><span>${details.wid} <a>Wallet ID</a></span></holder>`;
  html += `<holder><i class="glyph-icon flaticon-account"></i><span>${details.account.name} <a>Account Name</a></span></holder>`;
  html += `<holder><i class="glyph-icon flaticon-account-lock"></i><span>${details.account.type.toUpperCase()} <a>Account Type</a></span></holder>`;
  html += `<holder><i class="glyph-icon flaticon-swap"></i><span>${details.state.tx} <a>Number of Transactions</a></span></holder>`;
  html += `<holder><i class="glyph-icon flaticon-network"></i><span>${details.network.toUpperCase()} <a>Network</a></span></holder>`;

  return html;
}

Info.prototype.getWalletDetails = async function getWalletDetails() {
  let html = '<table>';
  const details = this.wallet.toJSON(true);
  const accPubKey = details.account.accountKey;
  const {tx, coin, confirmed, unconfirmed} = details.state;
  html += `<tr><td>Wallet Name</td><td colspan="2">${details.id}</td></tr>`;
  html += `<tr><td>Wallet ID</td><td colspan="2">${details.wid}</td></tr>`;
  html += `<tr><td>Wallet Key</td><td>${details.chksum.toString('hex')}★★★★★</td>`;
  html += `<td><i class="glyph-icon flaticon-copy" title="Copy"></i></td></tr>`;
  html += `<tr><td>Token</td><td title="${details.token}">${details.token.slice(0, 32)}...</td>`;
  html += `<td><i class="glyph-icon flaticon-copy" value="${details.token}" title="Copy"></i></td></tr>`;
  html += `<tr><td>Account Name</td><td colspan="2">${details.account.name}</td></tr>`;
  html += `<tr><td>Account Public Key</td><td title="${accPubKey}">${accPubKey.slice(0, 32)}...</td>`;
  html += `<td><i class="glyph-icon flaticon-copy" value="${accPubKey}" title="Copy"></i></td></tr>`;
  html += `<tr><td>Account Type</td><td colspan="2">${details.account.type.toUpperCase()}</td></tr>`;
  html += `<tr><td>Number of Transactions</td><td colspan="2">${tx}</td></tr>`;
  html += `<tr><td>Number of Coins</td><td colspan="2">${coin}</td></tr>`;
  html += `<tr><td>Confirm Balance</td><td colspan="2">${Amount.wmcc(confirmed, true)} wmcc</td></tr>`;
  html += `<tr><td>Unconfirm Balance</td><td colspan="2">${Amount.wmcc(unconfirmed, true)} wmcc</td></tr>`;
  html += `<tr><td>Network</td><td colspan="2">${details.network.toUpperCase()}</td></tr>`;
  html += `<tr><td>Watch Only</td><td colspan="2">${details.watchOnly.toString().toUpperCase()}</td></tr>`;

  html += '</table>';
  return html;
};

Info.prototype.getWalletHistory = async function getWalletHistory(limit, offset) {
  limit = parseInt(limit) || 10;
  offset = parseInt(offset) || 0;
  const txs = await this.wallet.getTransactions(this.wallet.account.name, limit, offset);
  return await this.getWalletHistoryTable(txs, { limit: limit, offset: offset});
}

Info.prototype.getWalletHistoryTable = async function getWalletHistoryTable(txs, options) {
  if (txs.length === 0)
    return `<h2>No transactions found in wallet <span>${this.wallet.id}</span> for account <span>${this.wallet.account.name}.</span></h2>`;

  let html = `<table><tr><th>Date/Time</th><th>Status</th><th>Height</th><th>Transactions Hash</th><th>Value</th></tr>`;

  for (let i=0; i<txs.length; i++) {
    const date = new Date(txs[i].mtime * 1000).format("M j, Y, g:i a");
    let status;

    const input = txs[i].inputs[0].address;

    let value = 0, send = false;
    if (input) {
      for (let j=0; j<txs[i].inputs.length; j++) {
        if (txs[i].inputs[j].path) {
          value += txs[i].inputs[j].value;// = sum(value, txs[i].inputs[j].value);
          send = true;
          status = 'Sent';
          if (txs[i].time === 0)
            status = 'Sending';
        }
      }
    }

    for (let j=0; j<txs[i].outputs.length; j++) {
      if (txs[i].outputs[j].path) {
        if (!send)
          value += txs[i].outputs[j].value;// = sum(value, txs[i].outputs[j].value);
        else
          value -= txs[i].outputs[j].value;// = substract(value, txs[i].outputs[j].value);
        if (status) continue;
        status = 'Received';
        if (txs[i].time === 0)
          status = 'Receiving';
        if (txs[i].tx.isCoinbase())
          status = options.pending ? 'Staled': 'Mined';
      }
    }
    let amm = 0;
    try {
      amm = Amount.wmcc(value);
    } catch (e) {
      console.log(e);
      console.log(txs[i]);
      console.log(value);
      amm = 'unknown';
    }
    html += `<tr>`
    html += `<td>${date}</td>`;
    html += `<td>${status}</td>`;
    if (txs[i].block)
      html += `<td title="${util.revHex(txs[i].block)}"><a class='r_goToExp'>${txs[i].height}</a></td>`;
    else
      html += `<td>N/A</td>`;
    html += `<td title="${txs[i].hash}"><a class='r_goToExp'>${txs[i].hash}</a></td>`;
    html += `<td>${amm}</td>`;
    html += `</tr>`;
  }
  html += `</table>`;

  if (!options.limit)
    return html;

  const pending = await this.wallet.getPending(this.wallet.account.name);
  const total = (await this.wallet.getTotal(this.wallet.account.name)) - pending.length; // todo: get total exclude pending

  html += page(total, options.offset, options.limit, 'r_walletGetHistory');
  /*const prev = offset - limit
  const next = offset + limit;
  const current = parseInt(offset/limit+1);
  const max = Math.ceil(total/limit);
  const {start, end} = median(current, max, 10);
  html += `<div class="page"><a ${(offset === 0) ? 'class="disable"' : 'class="r_walletGetHistory" offset="'+prev+'" limit="'+limit+'"'}>&#9668;</a>`;
  for(let i=start; i<end; i++) {
    html += `<a ${(current === i+1) ? 'class="active"' : 'class="r_walletGetHistory" offset="'+(limit*i)+'" limit="'+limit+'"'}>${i+1}</a>`;
  }
  html += `<a ${(next+1 > total) ? 'class="disable"' : 'class="r_walletGetHistory" offset="'+next+'" limit="'+limit+'"'}>&#9658;</a></div>`;
*/
  return html;
};

Info.prototype.getWalletPendingTx = async function getWalletPendingTx() {
  const txs = await this.wallet.getPendingDetails(this.wallet.account.name);
  return await this.getWalletHistoryTable(txs, {pending: true});
};

/* Adress book */
Info.prototype.setGenSearchAddress = async function setGenSearchAddress(addr) {
  let html = '',
      address = null;
  try {
    address = Address.fromString(addr);
  } catch (e) {
    html += `<div class="error"><h2>Opps! Invalid address format</h2><span>`;
    html += `<a>${addr}</a> is not a valid WMCC Address.<br>Please check and try again.</span>`;
    html += `<submit class="button r_genGotoAddresses">BACK</submit></div>`;
    return html;
  }

  const path = await this.wallet.getPath(address);
  if (!path) {
    html += `<div class="error"><h2>Opps! Address not found</h2><span>Cannot find <a>`;
    html += `${addr}</a> in this wallet (<a>${this.wallet.id}</a>).</span>`;
    html += `<submit class="button r_genGotoAddresses">BACK</submit></div>`;
    return html;
  }

  await this.setExpAddress(addr);

  const {metatx, coins} = this.explorer.details;

  let balance = 0;
  for (let coin of coins)
    balance += coin.value;

  let received = 0;
  for (let meta of metatx) {
    for (let output of meta.tx.outputs) {
      let out = output.getAddress() ? output.getAddress().hash: Buffer.alloc(0);
      if (address.hash.equals(out))
        received += output.value;
    }
  }
  const qrcode = $('<div id="qrcode"></div>').qrcode(address.hash.toString('hex'));
  const qrimg = qrcode[0].childNodes[0].toDataURL("image/png");
  const link = (metatx.length) ? `<i class="glyph-icon flaticon-record r_goToExp" value=${addr} title="View Transactions"></i>` : '';

  html += `<div class="address"><img src="${qrimg}"/><h2>Your WMCC Address</h2><table>`;
  html += `<tr><td>Number of Transactions</td><td><span>${metatx.length}${link}</span></td></tr>`;
  html += `<tr><td>Total Received</td><td><span>${Amount.wmcc(received, true)} wmcc</span></td></tr>`;
  html += `<tr><td>Address Hash 160</td><td><span class='address'>${address.hash.toString('hex')}</span></td></tr>`;
  html += `<tr><td>Final Balance</td><td><span>${Amount.wmcc(balance, true)} wmcc</span></td></tr>`;
  html += `</table>`;
  html += `<p><a>This is Your WMCC Address.</a><a class="address">${addr}</a>`;
  html += `<a>Share this with anyone so they can send you wmcoins.</a>`;
  html += `<submit class="button r_genGotoAddresses">BACK</submit></p></div>`;

  return html;
};

Info.prototype.getGenAddress = async function getGenAddress(limit = 10, offset = 0) {
  limit = parseInt(limit) || 10;
  offset = parseInt(offset) || 0;
  let html = '<table><tr><th>Type</th><th>Address</th><th>Hash 160</th><th></th></tr>';
  const paths = await this.wallet.getAccountPaths(this.wallet.account.name);

  const until = (limit+offset) > paths.length ? paths.length : offset+limit;
  //limit = limit < paths.length ? limit : paths.length;

  for (let i=offset; i<until; i++) {
    const addr = paths[i].toAddress();
    html += `<tr><td>${addr.getType()}</td><td><a class='r_genGotoAddress' title='${addr}'>${addr}</a></td>`;
    html += `<td><a title='${paths[i].hash}'>${paths[i].hash}</a></td>`;
    html += `<td><i class="glyph-icon flaticon-copy r_genCopyAddress" value="${addr}" title="Copy to clipboard"></i>`;
    html += `<i class="glyph-icon flaticon-gear r_walletManageAddress" title="Manage address"></i></td></tr>`;
  }
  html += `</table>`;

  const total = paths.length;

  html += page(total, offset, limit, 'r_genGotoAddresses');
  /*
  const prev = offset - limit;
  const next = offset + limit;
  const current = parseInt(offset/limit+1);
  const max = Math.ceil(total/limit);
  const {start, end} = median(current, max, 10);
  html += `<div class="page"><a ${(offset === 0) ? 'class="disable"' : 'class="r_genGotoAddresses" offset="'+prev+'" limit="'+limit+'"'}>&#9668;</a>`;
  for(let i=start; i<end; i++) {
    html += `<a ${(current === i+1) ? 'class="active"' : 'class="r_genGotoAddresses" offset="'+(limit*i)+'" limit="'+limit+'"'}>${i+1}</a>`;
  }
  html += `<a ${(next+1 > total) ? 'class="disable"' : 'class="r_genGotoAddresses" offset="'+next+'" limit="'+limit+'"'}>&#9658;</a></div>`;*/
  return html;
};

/* Explorer */
Info.prototype.getExpLatestBlocks = async function getExpLatestBlocks(max = 5) {
  if (!this.explorer.isHome) return '';
  const tip = this.node.chain.height;
  const row = parseInt(max);

  let html = `<h1>Latest Blocks</h1>` +
    `<table class='home'><tr><th>Height</th><th>Age</th><th>Transactions</th>` +
    `<th>Total Output (wmcc)</th><th>Size (kb)</th><th>Weight (kwu)</th></tr>`;

  for(let i=tip; i>(tip-row) && i > -1; i--) {
    const entry = await this.node.chain.getEntry(i);
    const block = await this.node.chain.getBlock(entry.hash);
    html += `<tr><td class='block r_goToExp'>${entry.height}</td>`;
    html += `<td class='timeAge' value='${entry.time}' k='2'>${age(entry.time)}</td>`;
    html += `<td>${block.txs.length}</td>`;
    html += `<td>${Amount.wmcc(block.getClaimed())}</td>`;
    html += `<td>${block.getVirtualSize()/1000}</td>`;
    html += `<td>${block.getWeight()/1000}</td></tr>`;
  }

  html += `</table>`;

  return html;
};

Info.prototype.getExpLatestTransaction = async function getExpLatestTransaction(max = 10) {
  if (!this.explorer.isHome)
    return '';

  let html = `<h1>Latest Transactions</h1>`;
  if (!this.node.mempool.map.size)
    return html+`<h2 class="empty">No latest transaction found.</h2>`;

  const row = parseInt(max);
  let count = 0;

  html += `<table class='home'><tr><th>Transaction Hash</th>` +
    `<th>Size (bytes)</th><th>Value (wmcc)</th></tr>`;

  this.node.mempool.map.forEach((value, hash) => {
    if (row > count) {
      html += `<tr><td class='tx r_goToExp'>${hash}</td>`;
      html += `<td>${value.size}</td>`;
      html += `<td>${Amount.wmcc(value.value, true)}</td></tr>`;
      count++;
    } else return;
  });

  html += `</table>`;

  return html;
};

Info.prototype.setExpBlockByHeight = async function setExpBlockByHeight(height) {
  try {
    const value = parseInt(height, 10);
    const entry = await this.node.chain.getEntry(value);
    const block = await this.node.chain.getBlock(entry.hash);
    this.explorer.details = {entry: entry, block: block};
    return entry.height || false;
  } catch (e) {
    return false;
  }
};

Info.prototype.setExpBlockByHash = async function setExpBlockByHash(hash) {
  try {
    const entry = await this.node.chain.getEntry(util.revHex(hash));
    const block = await this.node.chain.getBlock(util.revHex(hash));
    this.explorer.details = {entry: entry, block: block};
    return entry.rhash() || false;
  } catch (e) {
    return false;
  }
};

Info.prototype.getExpBlockByHeight = function getExpBlockByHeight(height) {
  const {entry} = this.explorer.details;
  return (entry) ? entry.height : this.setExpBlockByHeight(height || this.node.chain.tip.height);
};

Info.prototype.getExpHash = function getExpHash() {
  return this.explorer.details.entry.rhash();
};

Info.prototype.getExpPrevHash = function getExpPrevHash() {
  const {entry} = this.explorer.details;
  return entry.prevBlock !== encoding.NULL_HASH ? util.revHex(entry.prevBlock) : null;
};

Info.prototype.getExpNextHash = async function getExpNextHash() {
  const {entry} = this.explorer.details;
  const next = await this.node.chain.getNextHash(entry.hash);
  return next ? util.revHex(next) : null;
};

Info.prototype.getExpMerkleRoot = function getExpMerkleRoot() {
  const {entry} = this.explorer.details;
  return util.revHex(entry.merkleRoot)
};

Info.prototype.getExpChainwork = function getExpChainwork() {
  const {entry} = this.explorer.details;
  return entry.chainwork.toString('hex', 64);
};

Info.prototype.getExpTxCount = function getExpTxCount() {
  const {block} = this.explorer.details;
  return block.txs.length;
};

Info.prototype.getExpHeight = function getExpHeight() {
  return this.explorer.details.entry.height;
};

Info.prototype.getExpTimestamp = function getExpTimestamp() {
  const {entry} = this.explorer.details;
  return `${new Date(entry.time * 1000).format("F j, Y, h:i:s A")}`;
};

Info.prototype.getExpDifficulty = function getExpDifficulty() {
  return toDifficulty(this.getExpBits());
};

Info.prototype.getExpBits = function getExpBits() {
  return this.explorer.details.entry.bits;
};

Info.prototype.getExpNonce = function getExpNonce() {
  return this.explorer.details.entry.nonce;
};

Info.prototype.getExpConfirmation = function getExpConfirmation() {
  const {entry} = this.explorer.details;
  return this.node.chain.height - entry.height + 1;
};

Info.prototype.getExpVersion = function getExpVersion() {
  const {entry} = this.explorer.details;
  return `0x${util.hex32(entry.version)}`;
};

Info.prototype.getExpSize = function getExpSize() {
  const {block} = this.explorer.details;
  return `${block.getVirtualSize()} bytes`;
};

Info.prototype.getExpWeight = function getExpWeight() {
  const {block} = this.explorer.details;
  return `${block.getWeight()} bytes`;
};

Info.prototype.getExpTotalOut = function getExpTotalOut() {
  const {txs} = this.explorer.details.block;
  let total = 0;

  for (let tx of txs) {
    for (let vout of tx.outputs)
      total += vout.value;
  }

  return `${Amount.wmcc(total, true)} wmcc`;
};

Info.prototype.getExpFee = function getExpFee() {
  const {txs} = this.explorer.details.block;
  const {height} = this.explorer.details.entry;

  if (height === 0) return `0 wmcc`;

  for (let tx of txs) {
    if(tx.isCoinbase()) {
      const reward = consensus.getReward(height);
      const output = tx.outputs[0].value;
      return `${Amount.wmcc((output-reward), true)} wmcc`;
    }
  }
};

Info.prototype.getExpTransactions = async function getExpTransactions() {
  let html = '',
      misc = null;

  const {time} = this.explorer.details.block;
  const {txs} = this.explorer.details.block;

  for (let tx of txs) {
    const date = new Date(time * 1000).format("M d, Y, g:i:s A");
    const hash = tx.hash('hex');
    html += `<table class="transaction"><colgroup><col/><col/><col/></colgroup>`;
    html += `<tr><th colspan="2"><a class='tx r_goToExp'>${hash}</a><i class="glyph-icon flaticon-copy" value=${hash} title="Copy"></i>
      </th><th>${date}</th></tr><tr><td>`;

    const {details, totalout, totalin} = await this.toDetails(tx);

    html += toTxTable(details);

    if (tx.isCoinbase())
      misc = `(Size: ${tx.getVirtualSize()} bytes)`;
    else
      misc = `(Fee: ${Amount.wmcc((totalin-totalout), true)} wmcc, Size: ${tx.getVirtualSize()} bytes)`;

    html += `</td></tr><tr><td colspan='2'>${misc}</td><td>${Amount.wmcc(totalout, true)} wmcc</td></tr></table>`;
  }

  return html;
};

Info.prototype.setExpAddress = async function setExpAddress(address) {
  try {
    const addr = Address.fromString(address);
    const metatx = await this.node.chain.getMetaByAddress(address);
    const coins = await this.node.chain.getCoinsByAddress(address); // wc1qlj07dmavlnjktzv4wa4mznmluv3n7xgt5gqful wc1qssgu685d6r5y6h62qs9y6ldrxuva3jgfgnaxt2
    const memtx = await this.node.mempool.getAllMetaByAddress(addr);

    metatx.push.apply(metatx, filtermeta(memtx));
    metatx.sort(compare);
    this.explorer.details = {address: addr, metatx: metatx, coins: coins};

    return addr || false;
  } catch (e) {
    return false;
  }
};

Info.prototype.getExpAddress = function getExpAddress() {
  return `(${this.explorer.details.address})`;
};

Info.prototype.getExpAddressSummary = function getExpAddressSummary() {
  const {address, metatx, coins} = this.explorer.details;
  let html = '';
  let balance = 0;
  const qrcode = $('<div id="qrcode"></div>').qrcode(address.hash.toString('hex'));
  const qrimg = qrcode[0].childNodes[0].toDataURL("image/png");

  for (let coin of coins)
    balance += coin.value;

  let received = 0;
  for (let meta of metatx) {
    for (let output of meta.tx.outputs) {
      let out = output.getAddress() ? output.getAddress().hash: Buffer.alloc(0);
      if (address.hash.equals(out))
        received += output.value;
    }
  }

  html += `<table class="summary address"><tr><th colspan="5">Summary</th></tr>`;
  html += `<tr><td>Number of Transactions</td><td><span>${metatx.length}</span></td><td></td>`;
  html += `<td>Total Received</td><td><span>${Amount.wmcc(received, true)} wmcc</span></td></tr>`;
  html += `<tr><td>Address Hash 160</td><td><span class='address'>${address.hash.toString('hex')}</span></td><td></td>`;
  html += `<td>Final Balance</td><td><span>${Amount.wmcc(balance, true)} wmcc</span></td></tr>`;
  html += `</table><img src="${qrimg}"/>`;

  return html;
};

Info.prototype.getExpAdressTransactions = async function getExpAdressTransactions(limit, offset) {
  limit = parseInt(limit) || 50;
  offset = parseInt(offset) || 0;

  let html = '',
      misc = null;
  const {metatx, address} = this.explorer.details;
  const until = (limit+offset) > metatx.length ? metatx.length : offset+limit;

  for (let i=offset; i<until; i++) {
  //for (let meta of metatx) {
    const date = new Date((metatx[i].time||metatx[i].mtime) * 1000).format("M d, Y, g:i:s A");
    const hash = metatx[i].tx.hash('hex');
    html += `<table class="transaction"><colgroup><col/><col/><col/></colgroup>`;
    html += `<tr><th colspan="2"><a class='tx r_goToExp${metatx[i].block?"": " red' title='Unconfirmed transaction"}'>${hash}</a>
      <i class="glyph-icon flaticon-copy" value=${hash} title="Copy"></i></th><th>${date}</th></tr><tr><td>`;

    const {details, totalout, totalin} = await this.toDetails(metatx[i].tx);

    html += toTxTable(details, address.toString());

    if (metatx[i].tx.isCoinbase())
      misc = `(Size: ${metatx[i].tx.getVirtualSize()} bytes)`;
    else
      misc = `(Fee: ${Amount.wmcc((totalin-totalout), true)} wmcc, Size: ${metatx[i].tx.getVirtualSize()} bytes)`;

    html += `</td></tr><tr><td colspan='2'>${misc}</td><td>${Amount.wmcc(totalout, true)} wmcc</td></tr></table>`;/**/
  }
  if (!html) return `<div class='empty'>No transaction found for address: <a>${address}</a></div>`;

  const total = metatx.length;

  html += page(total, offset, limit, 'r_getExpAdressTransactions');

  return html;
};

Info.prototype.setExpTransaction = async function setExpTransaction(hash) {
  try {
    this.explorer.details = await this.node.chain.getMeta(hash); // ffbfc05411f9f0eaa0464fa7de970c8742f1df5069c64589fe95a3a1a2c29366
    return this.explorer.details || false;
  } catch (e) {
    return false;
  }
};

Info.prototype.getExpTransaction = function getExpTransaction() {
  return `(${this.explorer.details.tx.hash('hex')})`;
};

Info.prototype.getExpTransactionSummary = async function getExpTransactionSummary() {
  let html = '';
  const {tx, time, mtime, height, block} = this.explorer.details;
  const date = new Date((time||mtime) * 1000).format("M d, Y, g:i:s A");
  const {details, totalout, totalin} = await this.toDetails(tx);

  let totalinput = 0,
      fee = 0
  if (!tx.isCoinbase()) {
    totalinput = Amount.wmcc(totalin, true);
    fee = totalin-totalout;
  }

  const rate = fee > 0 ? Amount.wmcc(policy.getRate(tx.getVirtualSize(), fee), true) : 0;
  const wrate = fee > 0 ? Amount.wmcc(policy.getRate(tx.getWeight(), fee), true) : 0;
  const blkheight = height < 0 ? 'N/A': height;
  const blktitle = height < 0 ? '': util.revHex(block);
  const confirm = height < 0 ? 'Unconfirmed Transaction': this.node.chain.height - height + 1;

  html += `<table class="summary"><tr><th colspan="5">Summary</th></tr>`;
  html += `<tr><td>Size</td><td><span>${tx.getVirtualSize()} bytes</span></td><td></td>`;
  html += `<td>Total Input</td><td><span>${totalinput} wmcc</span></td></tr>`;
  html += `<tr><td>Weight</td><td><span>${tx.getWeight()} bytes</span></td><td></td>`;
  html += `<td>Total Output</td><td><span>${Amount.wmcc(totalout, true)} wmcc</span></td></tr>`;
  html += `<tr><td>Received Time</td><td><span>${date}</span></td><td></td>`;
  html += `<td>Fees</td><td><span>${Amount.wmcc(fee, true)} wmcc</span></td></tr>`;
  html += `<tr><td>Included In Block</td><td><span${(height<0)?"":" class='block r_goToExp"}' title='${blktitle}'>${blkheight}</span></td><td></td>`;
  html += `<td>Fee per kilobyte</td><td><span>${rate} wmcc/kb</span></td></tr>`;
  html += `<tr><td>Confirmations</td><td><span>${confirm}</span></td><td></td>`;
  html += `<td>Fee per weight unit</td><td><span>${wrate} wmcc/kwu</span></td></tr>`;
  html += `</table>`;

  return html;
};

Info.prototype.getExpTransactionTable = async function getExpTransactionTable() {
  let html = '';
  const {tx} = this.explorer.details;
  const hash = tx.hash('hex');

  html += `<table class="transaction"><colgroup><col/><col/><col/></colgroup>`;
  html += `<tr><th colspan="3"><a class='tx'>${hash}</a><i class="glyph-icon flaticon-copy" value=${hash} title="Copy"></i></th></tr><tr><td>`;

  const {details} = await this.toDetails(tx);

  html += toTxTable(details);
  html += `</td></tr></table>`;

  return html;
};

Info.prototype.getExpScripts = function getExpScripts() {
  let html = '';
  const {inputs, outputs} = this.explorer.details.tx;

  html += `<div class="scripts">`;
  if (inputs[0].getType() === 'coinbase')
    html += `<h2>Coinbase</h2>`;
  else
    html += `<h2>Input Scripts</h2><div>`;

  for (let input of inputs) {
    const script = input.script.toJSON();
    const witness = input.witness.toString();
    const commitment = input.script.getCommitment();
    if (script) {
      html += `<h3>${input.script.getInputTypeVal()}</h3>`;
      html += `<p>${script}</p>`;
    }
    if (commitment) {
      html += `<h3>Commitment hash</h3>`;
      html += `<p>${commitment.toString('hex')}</p>`;
    }
    if (witness) {
      html += `<h3>${input.witness.getInputTypeVal()}</h3>`;
      html += `<p>${witness}</p>`;
    }
  }

  html += `</div><div class="scripts"><h2>Output Scripts</h2>`;
  for (let output of outputs) {
    html += `<h3>${output.getType()}</h3>`;
    html += `<span>${output.script.toString()}</span>`;
    const commitment = output.script.getCommitment();
    if (commitment) {
      html += `<h3>Commitment hash</h3>`;
      html += `<span>${commitment.toString('hex')}</span>`;
    }
  }

  return `${html}</div>`;
};

Info.prototype.setExpPending = async function setExpPending(hash) {
  try {
    this.explorer.details = await this.node.mempool.getMeta(hash);
    return this.explorer.details || false;
  } catch (e) {
    return false;
  }
};

Info.prototype.getExpPending = function getExpPending() {
  return `(${this.explorer.details.tx.hash('hex')})`;
};

Info.prototype.toDetails = async function toDetails(tx) {
  let totalout = 0,
      totalin = 0,
      outputs = null;

  const details = {
    output: {},
    input: {},
    pending: []
  }

  for (let vin of tx.inputs) {
    if (tx.isCoinbase())
      continue;

    const chaintx = await this.node.chain.getTX(vin.prevout.hash);
    if (chaintx)
      outputs = chaintx.outputs;
    else {
      outputs = await this.node.mempool.getTX(vin.prevout.hash).outputs;
      details.pending.push(`${outputs[vin.prevout.index].getAddress()}`);
    }

    const input = outputs[vin.prevout.index].value;
    const inaddr = `${outputs[vin.prevout.index].getAddress()}`;

    if (details.input[inaddr])
      details.input[inaddr] += input;
    else
      details.input[inaddr] = input;

    totalin += input;
  }

  for (let vout of tx.outputs) {
    const outaddr = vout.script.getAddress() ? `${vout.script.getAddress()}`: 'unknown';
    if (details.output[outaddr])
      details.output[outaddr] += vout.value;
    else
      details.output[outaddr] = vout.value;

    totalout += vout.value;
  }

  return {
    details: details,
    totalin: totalin,
    totalout: totalout
  }
};

Info.prototype.isExpHome = function isExpHome(bool) {
  this.explorer.isHome = bool;
};

Info.prototype.resetExplorer = function resetExplorer() {
  this.explorer.details = false;
};

// Information
Info.prototype.getInfoUpdate = function getInfoUpdate() {
  let html;
  const json = require("./update/information.json").update;
  const major = json.major;
  const minor = json.minor;

  html = `<h2>Major Update ${major.version}</h2><table>`;
  for (let info of major.info)
    html += `<tr><td>${info}</td></tr>`;

  html += `</table><h2>Minor Update ${minor.version}</h2><table>`;
  for (let info of minor.info)
    html += `<tr><td>${info}</td></tr>`;

  html += `</table>`;

  return html;
};

Info.prototype.getInfoClient = function getInfoClient() {
  let html;

  const OS = require('os');
  const App = eval('require')('../../../package.json');
  const Core = eval('require')('../../wmcc-core/package.json');

  html = `<h2>Application Information</h2><table>`;
  html += `<tr><td>Client Name</td><td>${App.name}</td></tr>`;
  html += `<tr><td>Client Version</td><td>${App.version}</td></tr>`;
  html += `<tr><td>Operating System</td><td>${OS.type()} ${OS.release()} ${OS.arch()}</td></tr>`;
  html += `<tr><td>Release Date</td><td>${App.release}</td></tr></table>`;

  html += `<h2>Core Information</h2><table>`;
  html += `<tr><td>Client Name</td><td>${Core.name}</td></tr>`;
  html += `<tr><td>Client Version</td><td>${Core.version}</td></tr>`;
  html += `<tr><td>Release Date</td><td>${Core.release}</td></tr></table>`;

  return html;
};

Info.prototype.getInfoServer = async function getInfoServer() {
  let html;

  const client = Core.http.Client();
  const info = await client.getInfo();
  const sysdate = new Date(info.time.system * 1000).format("M j, Y, g:i a");
  const lastblk = new Date(this.node.chain.tip.time * 1000).format("M j, Y, g:i a");

  html = `<h2>General</h2><table><tr><td>Version</td><td>${info.version}</td></tr>`;
  html += `<tr><td>Network</td><td>${info.network}</td></tr>`;
  html += `<tr><td>Data Directory</td><td>${this.node.chain.db.options.prefix}</td></tr>`;
  html += `<tr><td>Time</td><td>${sysdate}</td></tr>`;
  html += `<tr><td>Uptime</td><td>${age(info.time.uptime, true)}</td></tr>`;
  html += `</table><h2>Network</h2><table>`;
  html += `<tr><td>Host</td><td>${info.pool.host}</td></tr>`;
  html += `<tr><td>Port</td><td>${info.pool.port}</td></tr>`;
  html += `<tr><td>Agent</td><td>${info.pool.agent}</td></tr>`;
  html += `<tr><td>Services</td><td>${info.pool.services}</td></tr>`;
  html += `<tr><td>Number of Connections</td><td>In: ${info.pool.inbound} / Out: ${info.pool.outbound}</td></tr>`;
  html += `</table><h2>Block Chain</h2><table>`;
  html += `<tr><td>Current Height</td><td>${info.chain.height}</td></tr>`;
  html += `<tr><td>Last Block Time</td><td>${lastblk}</td></tr>`;
  html += `<tr><td>Progress</td><td>${(info.chain.progress*100).toFixed(2)} <a style='font-family:Ubuntu, sans-serif;'>%</a></td></tr>`;
  html += `</table><h2>Mempool</h2><table>`;
  html += `<tr><td>Number of Transactions</td><td>${info.mempool.tx}</td></tr>`;
  html += `<tr><td>Memory Usage</td><td>${info.mempool.size}</td></tr></table>`;

  return html;
};

Info.prototype.getInfoPublicIP = async function getInfoPublicIP() {
  return await Core.net.external.getIPv4();
};

// Configuration

Info.prototype.getConfigBasic = async function getConfigBasic() {
  let html = '';

  const config = this.node.config;
  const def = config.getDefault();

  for (let cls of Object.keys(def)) {
    if (!cls) continue;
    html += `<h2>${cls}</h2>`;
    for (let opt in def[cls]){
      const val = def[cls][opt][0];
      const datatype = def[cls][opt][1];
      const disabled = def[cls][opt][2] ? '' : ' disabled';
      const clses = def[cls][opt][3] ? ` ${def[cls][opt][3]}` : '';
      const key = opt.replace(/-/g, '').toLowerCase();
      const value = config.data[key] || val;

      let input;
      if (datatype === 'bool') {
        const checked = (value==='true') ? ' checked': '';
        input = `<div class="checkbox${disabled}">
                 <input type="checkbox" id="checkbox-${opt}"${checked}${disabled} name="${opt}" />
                 <label class="checkbox-off" for="checkbox-${opt}"></label></div>`;
      } else
        input = `<input type='text' class='${datatype}${clses}' value='${value}'${disabled} name="${opt}" />`;

      html += `<div>${opt} ${val ? ' (default: '+val+')': ''}${input}</div>`;
    }
  }
  html += `<p class='result'></p><submit class="button s_configSave">UPDATE</submit>`;

  return html;
};

// Stratum

Info.prototype.getStratumInfo = function getStratumInfo() {
  let html;
  const info = this.node.stratum.options;
  const connected = this.node.stratum.inbound.size;
  const active = new Date(this.node.stratum.lastActive * 1000).format("M j, Y, g:i a");

  html = `<table><tr><td>Data Directory</td><td>${info.prefix}</td></tr>`;
  html += `<tr><td>Public Host</td><td>${info.publicHost}</td></tr>`;
  html += `<tr><td>Public Port</td><td>${info.publicPort}</td></tr>`;
  html += `<tr><td>Max Inbound</td><td>${info.maxInbound}</td></tr>`;
  html += `<tr><td>Difficulty</td><td>${info.difficulty}</td></tr>`;
  html += `<tr><td>Last Active</td><td>${active}</td></tr>`;
  html += `<tr><td>Connected Workers</td><td>${connected}</td></tr></table>`;

  return html;
};

Info.prototype.getStratumUsers = function getStratumUsers() {
  let html;
  const userdb = this.node.stratum.userdb;

  if (!userdb.size)
    return `<table><tr><th>No worker found in userdb.</th></tr></table>`;
  
  html = `<table class='workerlist'><tr><th>Worker Name</th><th>Password</th><th>Remove Worker</th></tr>`;
  userdb.map.forEach((value, key, map)=>{
    html += `<tr><td>${key}</td><td>★★★★★</td>`;
    html += `<td><i class="glyph-icon flaticon-remove s_stratumRemoveWorker" title="Remove Worker"></i></td></tr>`;
  });
  html += `</table>`;

  return html;
};

// General

/*
 * Helper
 */
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

function substract(a, b, exp = 8) {
  const dec = Math.pow(10, exp);
  return (a*dec - b*dec).toFixed(0)/dec;
}

function sum(a, b, exp = 8) {
  const dec = Math.pow(10, exp);
  return (a*dec + b*dec).toFixed(0)/dec;
}

function compare(a,b) {
  const atime = a.time ? a.time: a.mtime;
  const btime = b.time ? b.time: b.mtime;
  return (atime < btime) ? 1 : ((btime < atime) ? -1 : 0);
}

function toTxTable(details, address) {
  let html = '',
      type = false;

  if (Object.keys(details.input).length) {
    for (let input in details.input) {
      if (input === address)
        html += `<div><span>${input}</span>`, type = true;
      else if (details.pending.includes(input))
        html += `<div><i class="glyph-icon flaticon-copy next" title="Copy"></i>
          <span class='red address r_goToExp' title='Output from unconfirmed transaction'>${input}</span>`;
      else
        html += `<div><i class="glyph-icon flaticon-copy next" title="Copy"></i><span class='address r_goToExp'>${input}</span>`;
      html += `<span class='value'>${Amount.wmcc(details.input[input], true)} wmcc</span></div>`;
    }
  } else
    html += `<div><span class='coinbase'>No Inputs (Newly Generated Coins)</span></div>`;

  html += `</td><td><i class="glyph-icon flaticon-${type?'out red':'in green'}"></i></td><td>`;

  for (let output in details.output) {
    html += `<div>`;
    if (output === 'unknown')
      html += `<a class='unparsed'>Unparsed output address</a>`;
    else if (output === address)
      html += `<div><i class="glyph-icon flaticon-copy next" title="Copy"></i><span>${output}</span>`;
    else
      html += `<i class="glyph-icon flaticon-copy next" title="Copy"></i><span class='address r_goToExp'>${output}</span>`;

    html += `<span class='value'>${Amount.wmcc(details.output[output], true)} wmcc</span></div>`;
  }

  return html;
}

function page(total, offset, limit, cls) {
  let html = '';  
  const prev = offset - limit;
  const next = offset + limit;
  const current = parseInt(offset/limit+1);
  const max = Math.ceil(total/limit);
  const {start, end} = median(current, max, 10);
  html += `<div class="page"><a ${(offset === 0) ? 'class="disable"' : 'class="'+cls+'" offset="'+prev+'" limit="'+limit+'"'}>&#9668;</a>`;
  for(let i=start; i<end; i++) {
    html += `<a ${(current === i+1) ? 'class="active"' : 'class="'+cls+'" offset="'+(limit*i)+'" limit="'+limit+'"'}>${i+1}</a>`;
  }
  html += `<a ${(next+1 > total) ? 'class="disable"' : 'class="'+cls+'" offset="'+next+'" limit="'+limit+'"'}>&#9658;</a></div>`;
  return html;
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
    if (r[i] && c<2) {
      c++;
      o += ` ${r[i]} ${i}${r[i] > 1 ? 's':''}`;
    }
  });
  return `${o}${bool ? '':' ago'}`;
}

function filtermeta(meta) {
  return meta.filter( function(e,i,s) {
    return s[i].tx._hhash !== e.tx._hhash;
  });
}

function filtermeta(meta) {
  let d = [];
  return meta.filter( function(e) {
    if (d.indexOf(e.tx._hhash) === -1) {
      d.push(e.tx._hhash);
      return true;
    }
    return false;
  });
}

function median(c, m, l) {
  let s = Math.max(0, c-(l/2));
  const e = Math.min(s+l, m);
  s = Math.max(0,Math.min(e-l, e));
  return {start: s, end: e};
}

/*
 * Expose
 */

module.exports = Info;