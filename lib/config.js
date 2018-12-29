/*!
 * Copyright (c) 2018, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-desktop
 */
'use strict';

const Assert = require('assert');
const OS = require('os');
const Path = require('path');
//--
const HOME = OS.homedir ? OS.homedir() : '/';
//--
const {fs, util} = require('wmcc-core').utils;

/**
 * @module wmcc-node.Config
 */
class Config {
  constructor(module) {
    Assert(typeof module === 'string');
    Assert(module.length > 0);

    this.module = module;
    this.network = 'mainnet';
    this.prefix = Path.join(HOME, `.${module}`);

    this.options = Object.create(null);
    this.data = Object.create(null);
    this.env = Object.create(null);
    this.args = Object.create(null);
    this.argv = [];
    this.pass = [];
    this.query = Object.create(null);
    this.hash = Object.create(null);
  }

  getDefault() {
    return Config.DEFAULT;
  }

  inject(options) {
    for (const key of Object.keys(options)) {
      const value = options[key];

      switch (key) {
        case 'hash':
        case 'query':
        case 'env':
        case 'argv':
        case 'config':
          continue;
      }

      this.set(key, value);
    }
  }

  load(options) {
    if (options.hash)
      this.parseHash(options.hash);

    if (options.query)
      this.parseQuery(options.query);

    if (options.env)
      this.parseEnv(options.env);

    if (options.argv)
      this.parseArg(options.argv);

    this.network = this.getNetwork();
    this.prefix = this.getPrefix();
  }

  open(file) {
    if (fs.unsupported)
      return;

    const path = this.getFile(file);

    let text;
    try {
      text = fs.readFileSync(path, 'utf8');
    } catch (e) {
      if (e.code === 'ENOENT')
        return;
      throw e;
    }

    this.parseConfig(text);

    this.network = this.getNetwork();
    this.prefix = this.getPrefix();
  }

  set(key, value) {
    Assert(typeof key === 'string', 'Key must be a string.');

    if (value == null)
      return;

    key = key.replace(/-/g, '');
    key = key.toLowerCase();

    this.options[key] = value;
  }

  has(key) {
    if (typeof key === 'number') {
      Assert(key >= 0, 'Index must be positive.');
      if (key >= this.argv.length)
        return false;
      return true;
    }

    Assert(typeof key === 'string', 'Key must be a string.');

    key = key.replace(/-/g, '');
    key = key.toLowerCase();

    if (this.hash[key] != null)
      return true;

    if (this.query[key] != null)
      return true;

    if (this.args[key] != null)
      return true;

    if (this.env[key] != null)
      return true;

    if (this.data[key] != null)
      return true;

    if (this.options[key] != null)
      return true;

    return false;
  }

  get(key, fallback) {
    if (fallback === undefined)
      fallback = null;

    if (Array.isArray(key)) {
      const keys = key;
      for (const key of keys) {
        const value = this.get(key);
        if (value !== null)
          return value;
      }
      return fallback;
    }

    if (typeof key === 'number') {
      Assert(key >= 0, 'Index must be positive.');

      if (key >= this.argv.length)
        return fallback;

      if (this.argv[key] != null)
        return this.argv[key];

      return fallback;
    }

    Assert(typeof key === 'string', 'Key must be a string.');

    key = key.replace(/-/g, '');
    key = key.toLowerCase();

    if (this.hash[key] != null)
      return this.hash[key];

    if (this.query[key] != null)
      return this.query[key];

    if (this.args[key] != null)
      return this.args[key];

    if (this.env[key] != null)
      return this.env[key];

    if (this.data[key] != null)
      return this.data[key];

    if (this.options[key] != null)
      return this.options[key];

    return fallback;
  }

  typeOf(key) {
    const value = this.get(key);

    if (value === null)
      return 'null';

    return typeof value;
  }

  str(key, fallback) {
    const value = this.get(key);

    if (fallback === undefined)
      fallback = null;

    if (value === null)
      return fallback;

    if (typeof value !== 'string')
      throw new Error(`${fmt(key)} must be a string.`);

    return value;
  }

  int(key, fallback) {
    let value = this.get(key);

    if (fallback === undefined)
      fallback = null;

    if (value === null)
      return fallback;

    if (typeof value !== 'string') {
      if (typeof value !== 'number')
        throw new Error(`${fmt(key)} must be an int.`);

      if (!Number.isSafeInteger(value))
        throw new Error(`${fmt(key)} must be an int.`);

      return value;
    }

    if (!/^\-?\d+$/.test(value))
      throw new Error(`${fmt(key)} must be an int.`);

    value = parseInt(value, 10);

    if (!Number.isSafeInteger(value))
      throw new Error(`${fmt(key)} must be an int.`);

    return value;
  }

  uint(key, fallback) {
    const value = this.int(key);

    if (fallback === undefined)
      fallback = null;

    if (value === null)
      return fallback;

    if (value < 0)
      throw new Error(`${fmt(key)} must be a uint.`);

    return value;
  }

  float(key, fallback) {
    let value = this.get(key);

    if (fallback === undefined)
      fallback = null;

    if (value === null)
      return fallback;

    if (typeof value !== 'string') {
      if (typeof value !== 'number')
        throw new Error(`${fmt(key)} must be a float.`);

      if (!isFinite(value))
        throw new Error(`${fmt(key)} must be a float.`);

      return value;
    }

    if (!/^\-?\d*(?:\.\d*)?$/.test(value))
      throw new Error(`${fmt(key)} must be a float.`);

    if (!/\d/.test(value))
      throw new Error(`${fmt(key)} must be a float.`);

    value = parseFloat(value);

    if (!isFinite(value))
      throw new Error(`${fmt(key)} must be a float.`);

    return value;
  }

  ufloat(key, fallback) {
    const value = this.float(key);

    if (fallback === undefined)
      fallback = null;

    if (value === null)
      return fallback;

    if (value < 0)
      throw new Error(`${fmt(key)} must be a positive float.`);

    return value;
  }

  fixed(key, exp, fallback) {
    const value = this.float(key);

    if (fallback === undefined)
      fallback = null;

    if (value === null)
      return fallback;

    try {
      return util.fromFloat(value, exp || 0);
    } catch (e) {
      throw new Error(`${fmt(key)} must be a fixed number.`);
    }
  }

  ufixed(key, exp, fallback) {
    const value = this.fixed(key, exp);

    if (fallback === undefined)
      fallback = null;

    if (value === null)
      return fallback;

    if (value < 0)
      throw new Error(`${fmt(key)} must be a positive fixed number.`);

    return value;
  }

  bool(key, fallback) {
    const value = this.get(key);

    if (fallback === undefined)
      fallback = null;

    if (value === null)
      return fallback;

    // WMCoin Core compat.
    if (typeof value === 'number') {
      if (value === 1)
        return true;

      if (value === 0)
        return false;
    }

    if (typeof value !== 'string') {
      if (typeof value !== 'boolean')
        throw new Error(`${fmt(key)} must be a boolean.`);
      return value;
    }

    if (value === 'true' || value === '1')
      return true;

    if (value === 'false' || value === '0')
      return false;

    throw new Error(`${fmt(key)} must be a boolean.`);
  }

  buf(key, fallback, enc) {
    const value = this.get(key);

    if (!enc)
      enc = 'hex';

    if (fallback === undefined)
      fallback = null;

    if (value === null)
      return fallback;

    if (typeof value !== 'string') {
      if (!Buffer.isBuffer(value))
        throw new Error(`${fmt(key)} must be a buffer.`);
      return value;
    }

    const data = Buffer.from(value, enc);

    if (data.length !== Buffer.byteLength(value, enc))
      throw new Error(`${fmt(key)} must be a ${enc} string.`);

    return data;
  }

  array(key, fallback) {
    const value = this.get(key);

    if (fallback === undefined)
      fallback = null;

    if (value === null)
      return fallback;

    if (typeof value !== 'string') {
      if (!Array.isArray(value))
        throw new Error(`${fmt(key)} must be an array.`);
      return value;
    }

    const parts = value.trim().split(/\s*,\s*/);
    const result = [];

    for (const part of parts) {
      if (part.length === 0)
        continue;

      result.push(part);
    }

    return result;
  }

  obj(key, fallback) {
    const value = this.get(key);

    if (fallback === undefined)
      fallback = null;

    if (value === null)
      return fallback;

    if (typeof value !== 'object')
      throw new Error(`${fmt(key)} must be an object.`);

    return value;
  }

  func(key, fallback) {
    const value = this.get(key);

    if (fallback === undefined)
      fallback = null;

    if (value === null)
      return fallback;

    if (typeof value !== 'function')
      throw new Error(`${fmt(key)} must be a function.`);

    return value;
  }

  path(key, fallback) {
    let value = this.str(key);

    if (fallback === undefined)
      fallback = null;

    if (value === null)
      return fallback;

    switch (value[0]) {
      case '~': // home dir
        value = Path.join(HOME, value.substring(1));
        break;
      case '@': // prefix
        value = Path.join(this.prefix, value.substring(1));
        break;
      default: // cwd
        break;
    }

    return Path.normalize(value);
  }

  mb(key, fallback) {
    const value = this.uint(key);

    if (fallback === undefined)
      fallback = null;

    if (value === null)
      return fallback;

    return value * 1024 * 1024;
  }

  getNetwork() {
    let network = this.str('network');

    if (!network)
      network = 'mainnet';

    Assert(isAlpha(network), 'Bad network.');

    return network;
  }

  getPrefix() {
    let prefix = this.str('prefix');

    if (prefix) {
      if (prefix[0] === '~')
        prefix = Path.join(HOME, prefix.substring(1));
      return prefix;
    }

    prefix = Path.join(HOME, `.${this.module}`);

    const network = this.str('network');

    if (network) {
      Assert(isAlpha(network), 'Bad network.');
      if (network !== 'mainnet')
        prefix = Path.join(prefix, network);
    }

    return Path.normalize(prefix);
  }

  getFile(file) {
    const name = this.str('config');

    if (name)
      return name;

    return Path.join(this.prefix, file);
  }

  ensure() {
    if (fs.unsupported)
      return Promise.resolve();

    return fs.mkdirp(this.prefix);
  }

  location(file) {
    return Path.join(this.prefix, file);
  }

  write(file, text) {
    fs.writeFileSync(this.location(file), text);
  }

  parseConfig(text) {
    Assert(typeof text === 'string', 'Config must be text.');

    if (text.charCodeAt(0) === 0xfeff)
      text = text.substring(1);

    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\r/g, '\n');
    text = text.replace(/\\\n/g, '');

    let colons = true;
    let seen = false;
    let num = 0;

    for (const chunk of text.split('\n')) {
      const line = chunk.trim();

      num += 1;

      if (line.length === 0)
        continue;

      if (line[0] === '#')
        continue;

      const equal = line.indexOf('=');
      const colon = line.indexOf(':');

      let index = -1;

      if (colon !== -1 && (colon < equal || equal === -1)) {
        if (seen && !colons)
          throw new Error(`Expected '=' on line ${num}: "${line}".`);

        index = colon;
        seen = true;
        colons = true;
      } else if (equal !== -1) {
        if (seen && colons)
          throw new Error(`Expected ':' on line ${num}: "${line}".`);

        index = equal;
        seen = true;
        colons = false;
      } else {
        const symbol = colons ? ':' : '=';
        throw new Error(`Expected '${symbol}' on line ${num}: "${line}".`);
      }

      let key = line.substring(0, index).trim();

      key = key.replace(/\-/g, '');

      if (!isLowerKey(key))
        throw new Error(`Invalid option on line ${num}: ${key}.`);

      const value = line.substring(index + 1).trim();

      if (value.length === 0)
        continue;

      const alias = Config.ALIAS[key];

      if (alias)
        key = alias;

      this.data[key] = value;
    }
  }

  parseArg(argv) {
    if (!argv || typeof argv !== 'object')
      argv = process.argv;

    Assert(Array.isArray(argv));

    let last = null;
    let pass = false;

    for (let i = 2; i < argv.length; i++) {
      const arg = argv[i];

      Assert(typeof arg === 'string');

      if (arg === '--') {
        pass = true;
        continue;
      }

      if (pass) {
        this.pass.push(arg);
        continue;
      }

      if (arg.length === 0) {
        last = null;
        continue;
      }

      if (arg.indexOf('--') === 0) {
        const index = arg.indexOf('=');

        let key = null;
        let value = null;
        let empty = false;

        if (index !== -1) {
          // e.g. --opt=val
          key = arg.substring(2, index);
          value = arg.substring(index + 1);
          last = null;
          empty = false;
        } else {
          // e.g. --opt
          key = arg.substring(2);
          value = 'true';
          last = null;
          empty = true;
        }

        key = key.replace(/\-/g, '');

        if (!isLowerKey(key))
          throw new Error(`Invalid argument: --${key}.`);

        if (value.length === 0)
          continue;

        // Do not allow one-letter aliases.
        if (key.length > 1) {
          const alias = Config.ALIAS[key];
          if (alias)
            key = alias;
        }

        this.args[key] = value;

        if (empty)
          last = key;

        continue;
      }

      if (arg[0] === '-') {
        // e.g. -abc
        last = null;

        for (let j = 1; j < arg.length; j++) {
          let key = arg[j];

          if ((key < 'a' || key > 'z')
              && (key < 'A' || key > 'Z')
              && (key < '0' || key > '9')
              && key !== '?') {
            throw new Error(`Invalid argument: -${key}.`);
          }

          const alias = Config.ALIAS[key];

          if (alias)
            key = alias;

          this.args[key] = 'true';

          last = key;
        }

        continue;
      }

      // e.g. foo
      const value = arg;

      if (value.length === 0) {
        last = null;
        continue;
      }

      if (last) {
        this.args[last] = value;
        last = null;
      } else {
        this.argv.push(value);
      }
    }
  }

  parseEnv(env) {
    let prefix = this.module;

    prefix = prefix.toUpperCase();
    prefix = prefix.replace(/-/g, '_');
    prefix += '_';

    if (!env || typeof env !== 'object')
      env = process.env;

    Assert(env && typeof env === 'object');

    for (let key of Object.keys(env)) {
      const value = env[key];

      Assert(typeof value === 'string');

      if (!util.startsWith(key, prefix))
        continue;

      key = key.substring(prefix.length);
      key = key.replace(/_/g, '');

      if (!isUpperKey(key))
        continue;

      if (value.length === 0)
        continue;

      key = key.toLowerCase();

      // Do not allow one-letter aliases.
      if (key.length > 1) {
        const alias = Config.ALIAS[key];
        if (alias)
          key = alias;
      }

      this.env[key] = value;
    }
  }

  parseQuery(query) {
    if (typeof query !== 'string') {
      if (!global.location)
        return {};

      query = global.location.search;

      if (typeof query !== 'string')
        return {};
    }

    return this.parseForm(query, this.query);
  }

  parseHash(hash) {
    if (typeof hash !== 'string') {
      if (!global.location)
        return {};

      hash = global.location.hash;

      if (typeof hash !== 'string')
        return {};
    }

    return this.parseForm(hash, this.hash);
  }

  parseForm(query, map) {
    Assert(typeof query === 'string');

    if (query.length === 0)
      return;

    let ch = '?';

    if (map === this.hash)
      ch = '#';

    if (query[0] === ch)
      query = query.substring(1);

    for (const pair of query.split('&')) {
      const index = pair.indexOf('=');

      let key, value;
      if (index !== -1) {
        key = pair.substring(0, index);
        value = pair.substring(index + 1);
      } else {
        key = pair;
        value = 'true';
      }

      key = unescape(key);
      key = key.replace(/\-/g, '');

      if (!isLowerKey(key))
        continue;

      value = unescape(value);

      if (value.length === 0)
        continue;

      const alias = Config.ALIAS[key];

      if (alias)
        key = alias;

      map[key] = value;
    }
  }
}

/**
 * Constant
 */
Config.ALIAS = {
  'seed': 'seeds',
  'node': 'nodes',
  'n': 'network'
};

/**
 * Default options.
 * @const {Object}
 */

Config.DEFAULT = {
  'Options': {
    'network': ['mainnet', 'str', false]
  },
  'Node': {
    'prefix': ['~/.wmcc', 'str', true],
    'db': ['leveldb', 'str', false],
    'max-files': ['512', 'uint', true],
    'cache-size': ['100', 'mb', true]
  },
  'Logger': {
    'log-level': ['error', 'str', true],
    'log-file': ['true', 'bool', true]
  },
  'Chain': {
    'prune': ['false', 'bool', false],
    'index-tx': ['true', 'bool', false],
    'index-address': ['true', 'bool', false]
  },
  'Mempool': {
    'mempool-size': ['100', 'mb', true],
    'persistent-mempool': ['false', 'bool', false]
  },
  'Pool': {
    'listen': ['true', 'bool', false],
    'max-outbound': ['32', 'uint', true],
    'max-inbound': ['128', 'uint', true]
  },
  'Localhost (to listen on)': {
    'host': ['::', 'str', true],
    'port': ['8880', 'uint', true]
  },
  'Public Host (to advertise to peers)': {
    'public-host': ['127.0.0.1', 'str', true],
    'public-port': ['8880', 'uint', true]
  },
  'HTTP / RPC': {
    'http-host': ['::', 'str', true],
    'http-port': ['7880', 'uint', true],
    'api-key': ['', 'str', true],
    'no-auth': ['false', 'bool', true]
  },
  'Stratum Host (to listen to miners)': {
    'stratum-host': ['0.0.0.0', 'str', true],
    'stratum-port': ['6880', 'uint', true],
    'stratum-public-host': ['127.0.0.1', 'str', true],
    'stratum-public-port': ['6880', 'uint', true],
    'stratum-max-inbound': ['50', 'uint', true],
    'stratum-notify-interval': ['60', 'uint', true],
    'stratum-difficulty': ['1', 'uint', true]
  },
  'Miner': {
    'coinbase-flags': ['mined by wmcc_user', 'str', true, 'r_maxsize'],
    'coinbase-address': ['', 'str', true, 'r_checkAddress extrawidth']
  },
  'Wallet': {
    'wallet-witness': ['true', 'bool', true]
  },
  'Exchange': {
    'exchange-server-real': ['192.168.1.34:8000', 'real.wmccex.com:8000'],
    'exchange-server-demo': ['192.168.1.34:8000', 'demo.wmccex.com:8000']
  }
}

/*
 * Helpers
 */
function fmt(key) {
  if (Array.isArray(key))
    key = key[0];

  if (typeof key === 'number')
    return `Argument #${key}`;

  return key;
}

function unescape(str) {
  try {
    str = decodeURIComponent(str);
    str = str.replace(/\+/g, ' ');
  } catch (e) {
    ;
  }
  str = str.replace(/\0/g, '');
  return str;
}

function isAlpha(str) {
  return /^[a-z0-9]+$/.test(str);
}

function isKey(key) {
  return /^[a-zA-Z0-9]+$/.test(key);
}

function isLowerKey(key) {
  if (!isKey(key))
    return false;

  return !/[A-Z]/.test(key);
}

function isUpperKey(key) {
  if (!isKey(key))
    return false;

  return !/[a-z]/.test(key);
}
/**
 * Expose
 */
module.exports = Config;