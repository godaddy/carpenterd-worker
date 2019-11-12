const boot = require('booting');
const nsq = require('./preboot/nsq');
const http = require('./preboot/http');
const dirs = require('./preboot/dirs');
const config = require('./preboot/config');
const database = require('./preboot/database');
const log = require('./preboot/log');

module.exports = function carpenter(app) {
  return boot(app || new Map())
    .use(config)
    .use(log)
    .use(dirs)
    .use(http)
    .use(nsq)
    .use(database);
};

module.exports.worker = require('./worker');
