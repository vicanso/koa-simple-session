'use strict';
const app = require('./support/server');
const request = require('supertest');
const assert = require('assert');

describe('kog-simple-session', () => {
  let cookie;
  const mockCookie = 'koss:test_sid=X2DpE6Vql6k-EhdQsZ7lhLuJZZTimhTEundefined; path=/session; expires=Thu, 02 Jun 2016 10:14:42 GMT; httponly;koss:test_sid.sig=HVsCyBMgYeYBq2GNvvxjP6zTRAB; path=/session; expires=Thu, 02 Jun 2016 10:14:42 GMT; httponly';
  const validCookie = 'koss:test_sid=X2DpE6Vql6k-EhdQsZ7lhLuJZZTimhTEundefined; path=/session; expires=Thu, 02 Jun 2016 10:14:42 GMT; httponly;koss:test_sid.sig=HVsCyBMgYeYBq2GNvvxjP6zTR2k; path=/session; expires=Thu, 02 Jun 2016 10:14:42 GMT; httponly';
  it('should GET /session/get ok', done => {
    request(app)
    .get('/session/get')
    .expect('1')
    .end((err, res) => {
      if (err) {
        return done(err);
      }
      cookie = res.headers['set-cookie'].join(';');
      done();
    });
  });

  it('should GET /session/get second ok', done => {
    request(app)
    .get('/session/get')
    .set('cookie', cookie)
    .expect('2', done);
  });

  it('should GET /session/httponly ok', done => {
    request(app)
    .get('/session/httponly')
    .set('cookie', cookie)
    .expect(/httpOnly: false/, (err, res) => {
      if (err) {
        return done(err);
      }
      cookie = res.headers['set-cookie'].join(';');
      assert.equal(cookie.indexOf('httponly'), -1);
      assert(cookie.indexOf('expires=') > 0);
      request(app)
      .get('/session/get')
      .set('cookie', cookie)
      .expect('3', done);
    });
  });

  it('should GET /session/httponly twice ok', done => {
    request(app)
    .get('/session/httponly')
    .set('cookie', cookie)
    .expect(/httpOnly: true/, (err, res) => {
      if (err) {
        return done(err);
      }
      cookie = res.headers['set-cookie'].join(';');
      assert(cookie.indexOf('httponly') > 0);
      assert(cookie.indexOf('expires=') > 0);
      done();
    });
  });

  it('should another user GET /session/get ok', done => {
    request(app)
    .get('/session/get')
    .expect('1', done);
  });

  it('should GET /session/nothing ok', done => {
    request(app)
    .get('/session/nothing')
    .set('cookie', cookie)
    .expect('3', done);
  });

  it('should right cookie with empty session GET /session/get ok', done => {
    request(app)
    .get('/session/get')
    .set('cookie', validCookie)
    .expect('1', (err, res) => {
      if (err) {
        return done(err);
      }
      assert(res.headers['set-cookie']);
      done();
    });
  });

  it('should wrong cookie GET /session/get ok', done => {
    request(app)
    .get('/session/get')
    .set('cookie', mockCookie)
    .expect('1', (err, res) => {
      if (err) {
        return done(err);
      }
      assert(res.headers['set-cookie'])
      done();
    });
  });

  it('should wrong cookie GET /session/get twice ok', done => {
    request(app)
    .get('/session/get')
    .set('cookie', mockCookie)
    .expect('1', (err, res) => {
      if (err) {
        return done(err);
      }
      assert(res.headers['set-cookie'])
      done();
    });
  });

  it('should GET /wrongpath response no session', done => {
    request(app)
    .get('/wrongpath')
    .set('cookie', cookie)
    .expect(/no session/, done);
  });

  it('should GET /session/remove ok', done => {
    request(app)
    .get('/session/remove')
    .set('cookie', cookie)
    .expect('0', () => {
      request(app)
      .get('/session/get')
      .set('cookie', cookie)
      .expect('1', done);
    });
  });

  it('should GET / error by session ok', done => {
    request(app)
    .get('/')
    .expect(/no session/, done);
  });

  it('should GET /session ok', done => {
    request(app)
    .get('/session')
    .expect(/has session/, done);
  });

  it('should rewrite session before get ok', done => {
    request(app)
    .get('/session/rewrite')
    .expect({foo: 'bar', path: '/session/rewrite'}, done);
  });

  it('should regenerate a new session when session invalid', done => {
    request(app)
      .get('/session/get')
      .expect('1', err => {
        if (err) {
          return done(err);
        }
        request(app)
          .get('/session/nothing?valid=false')
          .expect('', err => {
            if (err) {
              return done(err);
            }
            request(app)
              .get('/session/get')
              .expect('1', done);
          });
      });
  });

  it('should GET /session ok', done => {
    request(app)
    .get('/session/id?test_sid_append=test')
    .expect(/test$/, done);
  });


  it('should force a session id ok', done => {
    request(app)
      .get('/session/get')
      .expect(/.*/, (err, res) => {
        if (err) {
          return done(err);
        }
        cookie = res.headers['set-cookie'][0].split(';');
        const val = cookie[0].split('=').pop();
        request(app)
          .get('/session/id?force_session_id=' + val)
          .expect(new RegExp(val), done);
      });
  });

  it('should regenerate existing sessions', done => {
    const agent = request.agent(app);
    agent
    .get('/session/get')
    .expect(/.+/, (err, res) => {
      const firstId = res.body;
      agent
        .get('/session/regenerate')
        .expect(/.+/, (err, res) => {
          assert.notEqual(res.body, firstId);
          done();
        });
    });
  });

  it('should regenerate a new session', done => {
    request(app)
      .get('/session/regenerateWithData')
      .expect({ /* foo: undefined, */ hasSession: true }, done);
  });

});