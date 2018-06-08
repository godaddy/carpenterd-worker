const preboot = require('../preboot/http');
const assume = require('assume');
const concat = require('concat-stream');
const http = require('http');
const url = require('url');

const noop = function () {};

function address(app, defaults) {
  return url.format(Object.assign({
    protocol: 'http:',
    hostname: '127.0.0.1',
    port: app.http.address().port
  }, defaults));
}

describe('healthcheck.test', function () {
  const app = new Map();
  app.log = {
    info: noop,
    error: noop
  };
  app.set('http', 0);

  before(function (done) {
    preboot(app, done);
  });

  after(function (done) {
    app.http.close(done);
  });

  it('should respond to healthcheck', function (done) {
    const uri = address(app, {
      pathname: '/healthcheck.html'
    });
    http.get(uri, (res) => {
      res.pipe(concat(body => {
        assume(res.statusCode).equals(200);
        assume(body.toString()).equals('ok');
        done();
      }));
    }).on('error', done);
  });
});
