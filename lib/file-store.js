'use strcit';
const pkg = require('../package');
const debug = require('debug')(pkg.name);
const map = new WeakMap();
const path = require('path');
const fs = require('fs');
const read = (file) => new Promise((resolve, reject) => {
  fs.readFile(file, (err, buf) => {
    /* istanbul ignore if */
    if (err) {
      reject(err);
    } else {
      resolve(buf);
    }
  });
});
const write = (file, str) => new Promise((resolve, reject) => {
  fs.writeFile(file, str, (err) => {
    /* istanbul ignore if */
    if (err) {
      reject(err);
    } else {
      resolve();
    }
  });
});
const exists = (file) => new Promise(resolve => {
  fs.exists(file, resolve);
});
class FileStore {
  constructor(f) {
    const file = f || path.join(__dirname, '../session.json');
    const data = {
      file,
    };
    map.set(this, data);
  }
  getSession() {
    const data = map.get(this);
    if (data.session) {
      return Promise.resolve(data.session);
    }
    const file = data.file;
    return exists(file)
      .then(isExists => {
        if (isExists) {
          return read(file, 'utf8');
        }
        /* istanbul ignore next */
        return '';
      })
      .then(str => {
        const json = JSON.parse(str || '{}');
        data.session = json;
        return json;
      });
  }
  sync() {
    const data = map.get(this);
    const file = data.file;
    return write(file, JSON.stringify(data.session));
  }
  get(sid) {
    return this.getSession()
      .then(data => {
        debug('get value %j with key %s', data[sid], sid);
        return data[sid];
      });
  }
  set(sid, val) {
    return this.getSession()
      .then(data => {
        debug('set value %j with key %s', val, sid);
        /* eslint no-param-reassign:0 */
        data[sid] = val;
        return this.sync();
      }).then(() => {
        debug('sync file store success');
      });
  }
  destroy(sid) {
    return this.getSession()
      .then(data => {
        delete data[sid];
        return this.sync();
      }).then(() => {
        debug('sync file store success');
      });
  }
}

module.exports = FileStore;
