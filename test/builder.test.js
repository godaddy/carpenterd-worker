/* eslint-disable max-nested-callbacks, no-process-env */
const Builder = require('../builder');
const fs = require('fs');
const uuid = require('uuid');
const databoot = require('../preboot/datastar');
const assume = require('assume');
const sinon = require('sinon');
const os = require('os');
const path = require('path');
const noop = function () {};
const fixtures = require('./fixtures');
const Writer = require('../writer');
const nsqStream = require('nsq-stream');

assume.use(require('assume-sinon'));

describe('Builder', function () {
  this.timeout(2E5);
  let builder;
  let sandbox;
  let app;
  before(function (done) {
    app = new Map();
    app.config = { get: noop };
    app.set('datastar', {
      config: {
        user: process.env.DATASTAR_USER,
        password: process.env.DATASTAR_PASSWORD,
        keyspace: process.env.DATASTAR_KEYSPACE,
        hosts: [process.env.DATASTAR_HOST],
        keyspaceOptions: {
          class: 'SimpleStrategy',
          replication_factor: 1
        }
      }
    });
    app.set('ensure', true);
    databoot(app, (err) => {
      builder = new Builder({
        log: { info: noop, error: noop, profile: noop },
        paths: { root: path.join(os.tmpdir(), 'carpenterd-worker') },
        datastar: app.datastar,
        models: app.models,
        bucket: process.env.AWS_BUCKET,
        pkgcloud: {
          provider: 'amazon',
          endpoint: 's3.amazonaws.com',
          keyId: process.env.AWS_KEY_ID,
          key: process.env.AWS_KEY,
          forcePathBucket: true
        },
        concurrency: 1
      });
      done(err);
    });

  });

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(builder.assets, 'publish');
  });

  afterEach(function () {
    sandbox.restore();
  });

  after(function (done) {
    builder = null;
    app.datastar.close(done);
  });

  describe('builder.write', function () {
    it('should not create the writer without a topic', function (done) {
      builder.assets.publish.yieldsAsync(null, null);
      sandbox.stub(builder.models.Build, 'findOne').yieldsAsync(null, null);
      sandbox.stub(builder.models.BuildHead, 'findOne').yieldsAsync(null, null);
      sandbox.stub(nsqStream, 'createWriteStream');

      builder.build({
        name: 'test',
        version: '1.0.0',
        env: 'dev'
      }, (err) => {
        assume(nsqStream.createWriteStream).is.not.called();
        done(err);
      });
    });
  });

  describe('builder.build', function () {
    it('should successfully fetch, build and publish assets', function (done) {
      builder.assets.publish.yieldsAsync(null, null);
      sandbox.stub(builder.models.Build, 'findOne').yieldsAsync(null, null);
      sandbox.stub(builder.models.BuildHead, 'findOne').yieldsAsync(null, null);

      builder.build({
        name: 'test',
        version: '1.0.0',
        env: 'dev'
      }, (err) => {
        assume(err).is.falsey();
        assume(builder.assets.publish).is.called(1);
        assume(builder.assets.publish).is.calledWith(sinon.match.object, sinon.match.object, sinon.match.func);
        done();
      });
    });

    it('should skip building when head version equals spec version', function (done) {
      sandbox.stub(builder.models.Build, 'findOne').yieldsAsync(null, null);
      sandbox.stub(builder.models.BuildHead, 'findOne').yieldsAsync(null, fixtures.head);

      builder.build({
        name: 'test',
        version: '1.0.0',
        env: 'dev'
      }, (err) => {
        assume(err).is.falsey();
        assume(builder.assets.publish.called).equals(false);
        done();
      });
    });

    it('should skip building when spec version is less than head version', function (done) {
      sandbox.stub(builder.models.Build, 'findOne').yieldsAsync(null, null);
      sandbox.stub(builder.models.BuildHead, 'findOne').yieldsAsync(null, fixtures.head);

      builder.build({
        name: 'test',
        version: '0.9.0',
        env: 'dev'
      }, (err) => {
        assume(err).is.falsey();
        assume(builder.assets.publish.called).equals(false);
        done();
      });
    });
  });

  describe('build.tarball', function () {
    it('should fetch tarball without issues', function (done) {
      const tarpath = path.join(os.tmpdir(), `${uuid()}-test-1.0.0`);
      builder.tarball({
        name: 'test',
        version: '1.0.0'
      }, tarpath, new Writer(), (err) => {
        assume(err).is.falsey();
        fs.stat(tarpath, (statErr) => {
          assume(statErr).is.falsey();
          done();
        });
      });
    });
  });

  describe('build.purge', function () {
    it('should run successfully', function (done) {
      builder.purge(done);
    });
  });
});
