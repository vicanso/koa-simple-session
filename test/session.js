'use strict';
const app = require('./support/server');
const request = require('supertest');

describe('kog-simple-session', () => {
  it('should GET /session/get ok', done => {
    request(app)
    .get('/session/get')
    .end((err, res) => {
      console.dir(res.headers);
      console.dir(res.text);
      done();
    });
  });
});