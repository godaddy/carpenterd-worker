const mkdirp = require('mkdirp');
const async = require('async');
const path = require('path');
const os = require('os');

module.exports = function dirs(app, next) {
  const tmp = app.config.get('tmp') || app.get('tmp') || os.tmpdir();

  const paths = app.paths = {
    root: path.join(tmp, 'carpenterd-worker'),
    tarball: path.join(tmp, 'tarballs')
  };

  const values = Object.keys(paths).map(k => paths[k]);

  async.each(values, (key, nxt) => mkdirp(key, nxt), next);
};
