const boot = require('booting');
const nsq = require('./preboot/nsq');
const http = require('./preboot/http');
const dirs = require('./preboot/dirs');
const config = require('./preboot/config');
const datastar = require('./preboot/datastar');
const log = require('./preboot/log');

module.exports = function carpenter(app) {
  return boot(app || new Map())
    .use(config)
    .use(log)
    .use(dirs)
    .use(http)
    .use(nsq)
    .use(datastar);
};

module.exports.worker = require('./worker');
