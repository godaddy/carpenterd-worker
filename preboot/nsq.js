const nsq = require('nsq.js-k8');
const nsqStream = require('nsq-stream');

module.exports = function nsqboot(app, next) {
  const config = Object.assign({}, app.get('nsq'), app.config.get('nsq'));
  if (Object.keys(config).length === 0) return next();

  //
  // NSQLOOKUPD doesnt quite get it right when fetching hosts.
  // We manually add the full DNS extension so the given hostname works in
  // every namespace.
  //
  config.addrModify = (addr) => {
    let [host, port] = addr.split(':');
    host = `${host}.${config.nsqdHostExt}`;
    return [host, port].join(':');
  };
  app.nsq = {};
  app.nsq.reader = nsq.reader(config);
  app.nsq.stream = nsqStream.createReadStream(app.nsq.reader);

  app.nsq.reader.on('error', app.log.error.bind(app.log));
  app.nsq.reader.on('error response', app.log.error.bind(app.log));

  next();
};
