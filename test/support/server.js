'use strict';
const Koa = require('koa');
const Store = require('../../lib/store');
const Redis = require('koa-simple-redis');
const session = require('../..');
const uid = require('uid-safe').sync;
const app = new Koa();
const http = require('http');

app.name = 'koa-session-test';
app.outputErrors = true;
app.keys = ['keys', 'keykeys'];
app.proxy = true;

app.use((ctx, next) => {
  if (ctx.query.force_session_id) {
    ctx.sessionId = ctx.query.force_session_id;
  }
  return next();
});

app.use(session({
  key: 'koss:test_sid',
  prefix: 'koss:test',
  ttl: 1000,
  cookie: {
    maxage: 86400,
    path: '/session',
  },
  store: new Redis(),
  genSid: (len, ctx) => {
    return uid(len) + ctx.query.test_sid_append;
  },
  beforeSave: (ctx, session) => {
    session.path = ctx.path;
  },
  valid: (ctx, session) => {
    return ctx.query.valid !== 'false';
  },
  reconnectTimeout: 100
}));
// will ignore repeat session
app.use(session({
  key: 'koss:test_sid',
  cookie: {
    maxAge: 86400,
    path: '/session',
  },
  genSid: (len, ctx) => {
    return uid(len) + ctx.query.test_sid_append;
  },
}));

function get(ctx) {
  ctx.session.count = ctx.session.count || 0;
  ctx.session.count++;
  ctx.body = ctx.session.count;
}
function nothing(ctx) {
  ctx.body = ctx.session.count;
}
function remove(ctx) {
  ctx.session = null;
  ctx.body = 0;
}
function switchHttpOnly(ctx) {
  const httpOnly = ctx.session.cookie.httpOnly;
  ctx.session.cookie.httpOnly = !httpOnly;
  ctx.body = 'httpOnly: ' + !httpOnly;
}
function other(ctx) {
  ctx.body = ctx.session !== undefined ? 'has session' : 'no session';
}
function getId(ctx) {
  ctx.body = ctx.sessionId;
}
function regenerate(ctx) {
  return ctx.regenerateSession().then(() => {
    ctx.session.data = 'foo';
    getId(ctx);
  });
}

app.use(ctx => {
  switch (ctx.path) {
    case '/favicon.ico':
      ctx.status = 404;
      break;
    case '/wrongpath':
      ctx.body = !ctx.session? 'no session' : 'has session';
      break;
    case '/session/rewrite':
      ctx.session = {
        foo: 'bar',
      };
      ctx.body = ctx.session;
      break;
    case '/session/notuse':
      ctx.body = 'not touch session';
      break;
    case '/session/get':
      get(ctx);
      break;
    case '/session/nothing':
      nothing(ctx);
      break;
    case '/session/remove':
      remove(ctx);
      break;
    case '/session/httponly':
      switchHttpOnly(ctx);
      break;
    case '/session/id':
      getId(ctx);
      break;
    case '/session/regenerate':
      return regenerate(ctx);
      break;
    case '/session/regenerateWithData':
      ctx.session.foo = 'bar';
      return regenerate(ctx).then(() => {
        ctx.body = { foo: ctx.session.foo, hasSession: ctx.session !== undefined };
      });
      break;
    default:
      other(ctx);
  }
});
module.exports = http.createServer(app.callback());
