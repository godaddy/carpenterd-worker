const async = require('async');
const Builder = require('./builder');
const Writable = require('stream').Writable;

module.exports = function worker(err, app) {
  if (err) throw err;

  app.log.info('Worker started');
  const builder = new Builder({
    log: app.log,
    models: app.models,
    datastar: app.datastar,
    retry: app.config.get('retry'),
    bucket: app.config.get('npm-tars:bucket'),
    pkgcloud: app.config.get('npm-tars:pkgcloud'),
    assets: app.config.get('assets'),
    env: app.config.get('env'),
    paths: app.paths
  });

  if (!app.nsq) {
    app.log.info('no nsq, spinning down');
    return void process.exit(0);
  }

  const write = (data, enc, cb) => {
    app.log.info('job completed', data);
    cb();
  };

  //
  // TODO: Wrap the `nsq` stream in another stream so that we can gracefully
  // end the stream and close the pipechain when we get SIGTERM so we dont kill
  // jobs mid build
  //
  app.nsq.stream
    .pipe(builder.stream())
    .pipe(new Writable({
      objectMode: true,
      write
    }))
    .on('finish', () => {
      app.log.info('All jobs completed, shutting down');
      setImmediate(() => shutdown(app));
    });
};

//
// TODO: Graceful shutdown in kubernetes for optimal uptime
// (ie during deploys as well as scenarios where we might be in a bad state);
//
function shutdown(app) {
  async.series([
    app.http.close.bind(app.http),
    app.datastar.close.bind(app.datastar)
  ], (err) => {
    if (err) app.log.error(err.message);
    process.exit(0);
  });
}
