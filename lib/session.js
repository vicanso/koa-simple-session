'use strict';

const pkg = require('../package');
const debug = require('debug')(pkg.name);
const crc32 = require('crc').crc32;
const parse = require('parseurl');

const FileStore = require('./file-store');
const Store = require('./store');
const uid = require('uid-safe');

/* istanbul ignore next */
function defaultErrorHanlder(err, type) {
  /* eslint no-param-reassign:0 */
  err.name = `${pkg.name} ${type} error`;
  throw err;
}

/* istanbul ignore next */
function noop() {
  return true;
}

/**
 * get the hash of a session include cookie options.
 */
function hash(sess) {
  return crc32.signed(JSON.stringify(sess));
}

module.exports = (opts) => {
  const options = opts || {};
  debug('options:%j', options);
  const key = options.key || 'koa.sid';
  const client = options.store || new FileStore();
  const errorHandler = options.errorHandler || defaultErrorHanlder;
  const reconnectTimeout = options.reconnectTimeout || 10 * 1000;
  const store = new Store(client, {
    ttl: options.ttl,
    prefix: options.prefix,
  });

  const genSid = options.genSid || uid.sync;
  const valid = options.valid || noop;
  const beforeSave = options.beforeSave || noop;

  const cookie = Object.assign({
    httpOnly: true,
    path: '/',
    overwrite: true,
    signed: true,
    maxAge: 24 * 60 * 60 * 1000,
  }, options.cookie);
  debug('cookie:%j', cookie);
  let storeStatus = 'available';
  let waitStore = Promise.resolve();
  /* istanbul ingore next */
  if (process.env.NODE_ENV === 'production' && client instanceof FileStore) {
    /* eslint no-console:0 */
    console.warn(`Warning: ${pkg.name}'s FileStore is not designed for a production environment.`);
  }

  const sessionIdStore = options.sessionIdStore || {
    get: ctx => ctx.cookies.get(key, cookie),

    set: (ctx, sid, session) => ctx.cookies.set(key, sid, session.cookie),

    reset: ctx => ctx.cookies.set(key, null),
  };

  /* istanbul ignore next */
  store.on('disconnect', () => {
    if (storeStatus !== 'available') {
      return;
    }
    storeStatus = 'pending';
    waitStore = new Promise((resolve, reject) => {
      setTimeout(() => {
        if (storeStatus === 'pending') {
          storeStatus = 'unavailable';
        }
        reject(new Error('session store is unavailable'));
      }, reconnectTimeout);
      store.once('connect', resolve);
    });
  });

  store.on('connect', () => {
    storeStatus = 'available';
    waitStore = Promise.resolve();
  });

  /**
   * generate a new session
   */
  function generateSession() {
    const session = {};
    // you can alter the cookie options in nexts
    session.cookie = {};
    Object.keys(cookie).forEach((prop) => {
      session.cookie[prop] = cookie[prop];
    });
    return session;
  }

  /**
   * check url match cookie's path
   */
  function matchPath(ctx) {
    const pathname = parse(ctx).pathname;
    if (pathname.indexOf(cookie.path || '/') !== 0) {
      debug('cookie path not match');
      return false;
    }
    return true;
  }

  function getSession(ctx) {
    if (!matchPath(ctx)) {
      return Promise.resolve();
    }
    if (storeStatus === 'unavailable') {
      return Promise.reject(new Error('session store is unavailable'));
    }
    const p = storeStatus === 'pending' ? waitStore : Promise.resolve();
    let isNew = false;
    return p.then(() => {
      if (!ctx.sessionId) {
        ctx.sessionId = sessionIdStore.get(ctx);
      }
      if (!ctx.sessionId) {
        debug('session id not exist, generate a new one');
        const session = generateSession();
        ctx.sessionId = genSid(24, ctx);
        isNew = true;
        return Promise.resolve(session);
      }
      return store.get(ctx.sessionId);
    }).then((s) => {
      let session = s;
      // make sure the session is still valid
      if (!session || !valid(ctx, session)) {
        debug('session is empty or invalid');
        session = generateSession();
        ctx.sessionId = genSid(24, ctx);
        sessionIdStore.reset(ctx);
        isNew = true;
      }
      const originalHash = !isNew && hash(session);
      return {
        originalHash,
        session,
        isNew,
      };
    });
  }

  // save empty session hash for compare
  const EMPTY_SESSION_HASH = hash(generateSession());

  function refreshSession(ctx, session, originalHash, isNew) {
    const sessionId = ctx.sessionId;
    // delete session
    if (!session) {
      if (!isNew) {
        debug('session set to null, destroy session: %s', sessionId);
        sessionIdStore.reset(ctx);
        return store.destroy(sessionId);
      }
      debug('a new session and set to null, ignore destroy');
      return Promise.resolve();
    }
    const newHash = hash(session);
    // if new session and not modified, just ignore
    if (!options.allowEmpty && isNew && newHash === EMPTY_SESSION_HASH) {
      debug('new session and do not modified');
      return Promise.resolve();
    }

    // rolling session will always reset cookie and session
    if (!options.rolling && newHash === originalHash) {
      debug('session not modified');
      return Promise.resolve();
    }
    debug('session modified');

    // custom before save hook
    beforeSave(ctx, session);
    sessionIdStore.set(ctx, ctx.sessionId, ctx.session);
    return store.set(sessionId, session).catch((err) => {
      debug('set session:%s error: %s', sessionId, err.message);
      errorHandler(err, 'set', ctx);
    });
  }
  return (ctx, next) => {
    ctx.sessionStore = store;
    if (ctx.session) {
      return next();
    }
    let result;
    return getSession(ctx).then((tmp) => {
      result = tmp;
      if (!result) {
        return next();
      }
      ctx.session = result.session;
      ctx.regenerateSession = () => {
        const complete = () => {
          ctx.session = generateSession();
          ctx.sessionId = genSid(24, ctx);
          sessionIdStore.reset(ctx);
          debug('created new session: %s', ctx.sessionId);
          result.isNew = true;
        };
        debug('regenerating session');
        if (!result.isNew) {
          // destroy the old session
          debug('destroying previous session');
          return store.destroy(ctx.sessionId).then(complete);
        }
        return Promise.resolve(complete());
      };
      return next();
    }).then(() => {
      if (!result || (ctx.session && Object.isFrozen(ctx.session))) {
        return Promise.resolve();
      }
      return refreshSession(ctx, ctx.session, result.originalHash, result.isNew);
    });
  };
};
