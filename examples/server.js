'use strict';
const Koa = require('koa');
const Redis = require('koa-simple-redis');
const session = require('..');
const app = new Koa();

function get(ctx) {
  const session = ctx.session;
  session.count = session.count || 0;
  session.count++;
  ctx.body = session.count;
}

function remove(ctx) {
  ctx.session = null;
  ctx.body = 0;
}

function regenerate(ctx) {
  get(ctx);
  return ctx.regenerateSession().then(() => {
    get(ctx);
  });
}

function freeze(ctx) {
  // the session is not sync to redis
  ctx.session.user = {
    a: 'b'
  };
  Object.freeze(ctx.session);
  ctx.body = ctx.session.user;
}

app.name = 'koa-session-test';
app.outputErrors = true;
app.keys = ['keys', 'keykeys'];
app.proxy = true;

app.use(session({
  store: new Redis(),
  key: 'my-cookie-key',
  prefix: 'my-session-store-prefix:',
  ttl: 24 * 3600 * 1000,
  errorHandler: (err, type, ctx) => {
    console.error(err);
  },
  reconnectTimeout: 5 * 1000,
}));

app.use(ctx => {
  switch (ctx.path) {
    case '/get':
      get(ctx);
      break;
    case '/remove':
      remove(ctx);
      break;
    case '/freeze':
      freeze(ctx);
      break;
    case '/regenerate':
      return regenerate(ctx);
  }
});

app.listen(3000);