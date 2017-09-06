const winston = require('winston');

module.exports = function loggers(app, next) {
  const opts = Object.assign({
    transports: [
      new (winston.transports.Console)({
        raw: app.env !== 'development'
      })
    ]
  }, app.get('logger'), app.config.get('logger'));

  app.log = new winston.Logger(opts);
  next();
};
