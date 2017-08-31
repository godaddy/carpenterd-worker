const http = require('http');

//
// Server for healthcheck
//
module.exports = function server(app, next) {
  let port = app.get('http');
  port = typeof port === 'number' ? port : app.config.get('http');
  const healthcheck = /healthcheck/;

  if (typeof port !== 'number') return next();

  app.http = http.createServer((req, res) => {

    if (healthcheck.test(req.url)) return res.end('ok');

    app.log.info('non healthcheck request', {
      method: req.method,
      url: req.url
    });

    res.statusCode = 404;
    res.end('not found');
  });

  app.http.listen(port, err => {
    if (err) {
      app.log.error('Http server failure', {
        message: err.message
      });
    }

    next(err);
  });
};
