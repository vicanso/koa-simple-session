'use strict';
const assert = require('assert');
const FileStore = require('../lib/file-store');
const uid = require('uid-safe');
describe('file-store', () => {
  const store = new FileStore();
  const sid = uid.sync(24);
  it('set data success', done => {
    store.set(sid, {
      sid,
    }).then(done).catch(done);
  });

  it('get data success', done => {
    store.get(sid).then(data => {
      assert.equal(data.sid, sid);
      done();
    }).catch(done);
  });

  it('destroy success', done => {
    store.destroy(sid)
      .then(() => {
        return store.get(sid);
      })
      .then(data => {
        assert.equal(data, undefined);
        done();
      })
      .catch(done);
  });
});