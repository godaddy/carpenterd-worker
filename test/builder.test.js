/* eslint-disable max-nested-callbacks, no-process-env */
const Builder = require('../builder');
const fs = require('fs');
const uuid = require('uuid');
const databoot = require('../preboot/database');
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
  let app;

  const config = {
    database: {
      endpoint: 'http://localhost:4569',
      region: 'us-east-1'
    },
    ensure: true
  };

  before(function (done) {
    app = new Map();
    app.config = { get: prop => config[prop] };
    databoot(app, (err) => {
      builder = new Builder({
        log: { info: noop, error: noop, profile: noop },
        paths: { root: path.join(os.tmpdir(), 'carpenterd-worker') },
        database: app.database,
        models: app.models,
        bucket: process.env.WRHS_TEST_AWS_PREFIX,
        pkgcloud: {
          provider: 'amazon',
          endpoint: 's3.amazonaws.com',
          keyId: process.env.WRHS_TEST_AWS_KEY_ID,
          key: process.env.WRHS_TEST_AWS_KEY,
          forcePathBucket: true
        },
        concurrency: 1
      });

      done(err);
    });
  });

  beforeEach(function () {
    sinon.stub(builder.assets, 'publish');
  });

  afterEach(function () {
    sinon.restore();
  });

  after(function () {
    builder = null;
  });

  describe('builder.write', function () {
    it('should not create the writer without a topic', function (done) {
      builder.assets.publish.yieldsAsync(null, null);
      sinon.stub(builder.models.Build, 'findOne').yieldsAsync(null, null);
      sinon.stub(builder.models.BuildHead, 'findOne').yieldsAsync(null, null);
      sinon.stub(nsqStream, 'createWriteStream');

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
    it('should successfully fetch, build and publish assets with implicit promotion', function (done) {
      builder.assets.publish.yieldsAsync(null, null);
      sinon.stub(builder.models.Build, 'findOne').yieldsAsync(null, null);
      sinon.stub(builder.models.BuildHead, 'findOne').yieldsAsync(null, null);

      builder.build({
        name: 'test',
        version: '1.0.0',
        env: 'dev'
      }, (err) => {
        assume(err).is.falsey();
        assume(builder.assets.publish).is.called(1);
        assume(builder.assets.publish).is.calledWithMatch({
          name: 'test',
          version: '1.0.0',
          env: 'dev'
        }, { promote: true }, sinon.match.func);
        done();
      });
    });

    it('should successfully fetch, build and publish assets with explicit promotion', function (done) {
      builder.assets.publish.yieldsAsync(null, null);
      sinon.stub(builder.models.Build, 'findOne').yieldsAsync(null, null);
      sinon.stub(builder.models.BuildHead, 'findOne').yieldsAsync(null, null);

      builder.build({
        name: 'test',
        version: '1.0.0',
        env: 'dev',
        promote: true
      }, (err) => {
        assume(err).is.falsey();
        assume(builder.assets.publish).is.called(1);
        assume(builder.assets.publish).is.calledWithMatch({
          name: 'test',
          version: '1.0.0',
          env: 'dev'
        }, { promote: true }, sinon.match.func);
        done();
      });
    });

    it('should successfully fetch, build and publish assets without promotion', function (done) {
      builder.assets.publish.yieldsAsync(null, null);
      sinon.stub(builder.models.Build, 'findOne').yieldsAsync(null, null);
      sinon.stub(builder.models.BuildHead, 'findOne').yieldsAsync(null, null);

      builder.build({
        name: 'test',
        version: '1.0.0',
        env: 'dev',
        promote: false
      }, (err) => {
        assume(err).is.falsey();
        assume(builder.assets.publish).is.called(1);
        assume(builder.assets.publish).is.calledWithMatch({
          name: 'test',
          version: '1.0.0',
          env: 'dev'
        }, { promote: false }, sinon.match.func);
        done();
      });
    });

    it('should skip building when head version equals spec version', function (done) {
      sinon.stub(builder.models.Build, 'findOne').yieldsAsync(null, null);
      sinon.stub(builder.models.BuildHead, 'findOne').yieldsAsync(null, fixtures.head);

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
      sinon.stub(builder.models.Build, 'findOne').yieldsAsync(null, null);
      sinon.stub(builder.models.BuildHead, 'findOne').yieldsAsync(null, fixtures.head);

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

    describe('spec validations', function () {
      beforeEach(function () {
        builder.assets.publish.yieldsAsync(null, null);
        sinon.stub(builder.models.Build, 'findOne').yieldsAsync(null, null);
        sinon.stub(builder.models.BuildHead, 'findOne').yieldsAsync(null, fixtures.head);
      });

      function assumeNothingCalled() {
        assume(builder.models.Build.findOne).was.not.called();
        assume(builder.models.BuildHead.findOne).was.not.called();
        assume(builder.assets.publish).was.not.called();
      }

      it('should should return an error when there is no version specified', function (done) {
        builder.build({
          name: 'test',
          // explicitly no version
          env: 'dev'
        }, (err) => {
          assume(err).is.truthy();
          assume(err.message).equals('Invalid version specified');
          assumeNothingCalled();
          done();
        });
      });

      it('should should return an error when there is an invalid version specified', function (done) {
        builder.build({
          name: 'test',
          version: 'trash.panda',
          env: 'dev'
        }, (err) => {
          assume(err).is.truthy();
          assume(err.message).equals('Invalid version specified');
          assumeNothingCalled();
          done();
        });
      });

      it('should should return an error when there is no name specified', function (done) {
        builder.build({
          // Explicitly no name
          version: '1.2.3',
          env: 'dev'
        }, (err) => {
          assume(err).is.truthy();
          assume(err.message).equals('name not specified');
          assumeNothingCalled();
          done();
        });
      });

      it('should should return an error when there is no env specified', function (done) {
        builder.build({
          name: 'test',
          version: '1.2.3'
          // Explicitly no env
        }, (err) => {
          assume(err).is.truthy();
          assume(err.message).equals('env not specified');
          assumeNothingCalled();
          done();
        });
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

  describe('status messages', function () {
    before(function () {
      builder = new Builder({
        log: { info: noop, error: noop, profile: noop },
        paths: { root: path.join(os.tmpdir(), 'carpenterd-worker') },
        database: app.database,
        models: app.models,
        bucket: process.env.WRHS_TEST_AWS_PREFIX,
        pkgcloud: {
          provider: 'amazon',
          endpoint: 's3.amazonaws.com',
          keyId: process.env.WRHS_TEST_AWS_KEY_ID,
          key: process.env.WRHS_TEST_AWS_KEY,
          forcePathBucket: true
        },
        concurrency: 1,
        status: {
          writer: {},
          topic: 'status'
        }
      });
    });

    it('should successfully publish status messages for fetch, build and publishing assets', function (done) {
      const expectedMessage = {
        eventType: 'event',
        name: 'test',
        env: 'dev',
        version: '1.0.0',
        locale: 'en-US',
        buildType: 'webpack'
      };

      builder.assets.publish.yieldsAsync(null, null);
      sinon.stub(builder.models.Build, 'findOne').yieldsAsync(null, null);
      sinon.stub(builder.models.BuildHead, 'findOne').yieldsAsync(null, null);

      const mockWriteStream = {
        write: sinon.stub().yields(),
        end: sinon.stub().yields(),
        _writableState: {}
      };
      sinon.stub(nsqStream, 'createWriteStream').returns(mockWriteStream);

      builder.build({
        name: 'test',
        version: '1.0.0',
        env: 'dev',
        locale: 'en-US',
        type: 'webpack'
      }, (err) => {


        // tarball
        assume(mockWriteStream.write).calledWithMatch({
          ...expectedMessage,
          message: 'Fetched tarball'
        }, sinon.match.func);

        // webpack start
        assume(mockWriteStream.write).calledWithMatch({
          ...expectedMessage,
          message: 'webpack build start'
        }, sinon.match.func);

        // webpack complete
        assume(mockWriteStream.write).calledWithMatch({
          ...expectedMessage,
          message: 'webpack build completed'
        }, sinon.match.func);

        // published
        assume(mockWriteStream.write).calledWithMatch({
          ...expectedMessage,
          message: 'Assets published'
        }, sinon.match.func);

        assume(mockWriteStream.end).calledWithMatch({
          eventType: 'complete',
          message: 'carpenterd-worker build completed',
          name: 'test',
          env: 'dev',
          version: '1.0.0',
          locale: 'en-US',
          buildType: 'webpack'
        }, sinon.match.func);

        done(err);
      });
    });
  });
});
