const { transports, format, createLogger } = require('winston');

module.exports = function loggers(app, next) {
  const opts = Object.assign({
    format: format.combine(
      format.timestamp(),
      format.splat(),
      format.json()
    ),
    transports: [new (transports.Console)()]
  }, app.get('logger'), app.config.get('logger'));

  app.log = createLogger(opts);
  next();
};
