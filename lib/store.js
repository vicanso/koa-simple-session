'use strict';

const pkg = require('../package');
const debug = require('debug')(pkg.name);
const EventEmitter = require('events');

const map = new WeakMap();

class Store extends EventEmitter {
  constructor(client, options) {
    super();
    const opts = Object.assign({
    }, options);
    if (!opts.prefix) {
      opts.prefix = 'koa:sess:';
    }
    map.set(this, {
      client,
      opts,
    });
    // delegate client connect / disconnect event
    if (client && typeof client.on === 'function') {
      ['disconnect', 'connect'].forEach(event => client.on(event, this.emit.bind(this, event)));
    }
  }
  get(sid) {
    const internalData = map.get(this);
    const client = internalData.client;
    const opts = internalData.opts;
    const id = opts.prefix + sid;
    debug('GET %s', id);
    return client.get(id)
      .then((data) => {
        if (!data) {
          debug('GET %s empty', id);
          return null;
        }
        if (data && data.cookie && typeof data.cookie.expires === 'string') {
          // make sure data.cookie.expires is a Date
          /* eslint no-param-reassign:0 */
          data.cookie.expires = new Date(data.cookie.expires);
        }
        return data;
      });
  }
  set(sid, sess) {
    const internalData = map.get(this);
    const client = internalData.client;
    const opts = internalData.opts;
    let ttl = opts.ttl;
    if (!ttl) {
      const maxAge = sess.cookie && sess.cookie.maxAge;
      if (typeof maxAge === 'number') {
        ttl = maxAge;
      }
      // if has cookie.expires, ignore cookie.maxAge
      if (sess.cookie && sess.cookie.expires) {
        ttl = Math.ceil(sess.cookie.expires.getTime() - Date.now());
      }
    }
    const id = opts.prefix + sid;
    debug('SET key: %s, value: %j, ttl: %d', id, sess, ttl);
    return client.set(id, sess, ttl).then((data) => {
      debug('SET %s complete', id);
      return data;
    });
  }
  destroy(sid) {
    const internalData = map.get(this);
    const client = internalData.client;
    const opts = internalData.opts;
    const id = opts.prefix + sid;
    debug('DEL %s', id);
    return client.destroy(id).then((data) => {
      debug('DEL %s complete', id);
      return data;
    });
  }
  refreshTTL(sid, _ttl) {
    const internalData = map.get(this);
    const client = internalData.client;
    const opts = internalData.opts;
    const id = opts.prefix + sid;
    const ttl = _ttl || opts.ttl;
    if (!ttl) {
      return Promise.resolve();
    }
    return client.ttl(id, ttl);
  }
}

module.exports = Store;
