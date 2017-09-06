const path = require('path');
const configure = require('slay-config');
const nconf = require('nconf');

module.exports = function config(app, next) {
  app.env = process.env.NODE_ENV || 'development';
  // where to find config root
  app.rootDir = app.rootDir || path.join(__dirname, '..');
  app.config = new nconf.Provider();
  configure()(app, Object.create(null), next);
};
