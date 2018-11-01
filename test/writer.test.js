/* eslint max-nested-callbacks: 0 */
const Writer = require('../writer');
const assume = require('assume');
const sinon = require('sinon');
const nsqStream = require('nsq-stream');
const { performance } = require('perf_hooks');
assume.use(require('assume-sinon'));

describe('Writer', function () {
  let mockNsqWriter, mockWriteStream;

  beforeEach(function () {
    mockNsqWriter = { publish: sinon.stub() }; // Not an accurate stub, just a placeholder

    mockWriteStream = {
      write: sinon.stub().yields(),
      end: sinon.stub().yields(),
      _writableState: {}
    };

    sinon.stub(nsqStream, 'createWriteStream').returns(mockWriteStream);
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('constructor', function () {
    it('only creates the stream if it has a topic and writer', function () {
      // eslint-disable-next-line no-unused-vars
      let writer = new Writer({});
      assume(nsqStream.createWriteStream).not.called();

      writer = new Writer({ topic: 'topic' });
      assume(nsqStream.createWriteStream).not.called();

      writer = new Writer({ writer: mockNsqWriter });
      assume(nsqStream.createWriteStream).not.called();

      writer = new Writer({ writer: mockNsqWriter, topic: 'topic' });
      assume(nsqStream.createWriteStream).calledWith(mockNsqWriter, 'topic');
    });

    it('sets the spec', function () {
      const writer = new Writer({ writer: mockNsqWriter, topic: 'topic', spec: 'spec', log: 'log' });
      assume(writer.spec).equals('spec');
    });

    it('sets the logger', function () {
      const writer = new Writer({ writer: mockNsqWriter, topic: 'topic', spec: 'spec', log: 'log' });
      assume(writer.log).equals('log');
    });
  });

  describe('api', function () {
    let writer, mockLog;
    const expectedMessage = {
      name: 'package-name',
      env: 'dev',
      version: '1.2.3',
      locale: 'en-US',
      buildType: 'webpack'
    };

    beforeEach(function () {
      mockLog = { error: sinon.stub() };
      writer = new Writer({
        writer: mockNsqWriter,
        topic: 'topic',
        log: mockLog,
        spec: {
          name: 'package-name',
          env: 'dev',
          version: '1.2.3',
          locale: 'en-US',
          type: 'webpack'
        }
      });
    });

    describe('write', function () {
      it('noops without a writeStream', function (done) {
        writer.writeStream = null;
        sinon.stub(writer, 'buildStatusMessage');

        writer.write(null, { eventType: 'complete' }, function () {
          assume(writer.buildStatusMessage).not.called();
          done();
        });
      });

      it('logs an error if the stream is no longer writable', function (done) {
        writer.writeStream._writableState.ended = true;

        writer.write(null, { eventType: 'complete' }, function () {
          assume(mockLog.error).calledWith('Unable to write to stream', sinon.match.object);
          done();
        });
      });

      it('writes an error if statusInfo contains an error', function (done) {
        writer.write(null, {
          error: new Error('Penguins are flying'),
          eventType: 'event',
          message: 'Penguins grounded'
        },
        function () {
          assume(writer.writeStream.write).calledWithMatch({
            ...expectedMessage,
            eventType: 'error',
            message: 'Penguins are flying'
          }, sinon.match.func);

          done();
        });
      });

      it('writes an error if statusInfo contains an error with timing information', function (done) {
        writer.timings.set('forever', performance.now() - 20);
        writer.write('forever', {
          error: new Error('Penguins are flying'),
          eventType: 'event',
          message: 'Penguins grounded'
        },
        function () {
          assume(writer.writeStream.write).calledWithMatch({
            ...expectedMessage,
            eventType: 'error',
            message: 'Penguins are flying',
            timing: sinon.match.number
          }, sinon.match.func);

          done();
        });
      });

      it('writes the message to the stream', function (done) {
        writer.write(null, { eventType: 'event' }, function () {
          assume(writer.writeStream.write).calledWithMatch({
            ...expectedMessage,
            eventType: 'event'
          }, sinon.match.func);

          done();
        });
      });

      it('writes the message to the stream with timing information', function (done) {
        writer.timings.set('forever', performance.now() - 20);
        writer.write('forever', { eventType: 'event' }, function () {
          assume(writer.writeStream.write).calledWithMatch({
            ...expectedMessage,
            eventType: 'event',
            timing: sinon.match.number
          }, sinon.match.func);

          done();
        });
      });
    });

    describe('end', function () {
      it('noops without a writeStream', function (done) {
        writer.writeStream = null;
        sinon.stub(writer, 'buildStatusMessage');

        writer.end(null, { eventType: 'complete' }, function () {
          assume(writer.buildStatusMessage).not.called();
          done();
        });
      });

      it('logs an error if the stream is no longer writable', function (done) {
        writer.writeStream._writableState.ended = true;

        writer.end(null, { eventType: 'complete' }, function () {
          assume(mockLog.error).calledWith('Unable to end stream', sinon.match.object);
          done();
        });
      });

      it('ends the stream with the given message', function (done) {
        writer.end(null, { eventType: 'complete' }, function () {
          assume(writer.writeStream.end).calledWithMatch({
            ...expectedMessage,
            eventType: 'complete'
          }, sinon.match.func);

          done();
        });
      });

      it('ends the stream with timing information', function (done) {
        writer.timings.set('forever', performance.now() - 20);
        writer.end('forever', { eventType: 'complete' }, function () {
          assume(writer.writeStream.end).calledWithMatch({
            ...expectedMessage,
            eventType: 'complete',
            timing: sinon.match.number
          }, sinon.match.func);

          done();
        });
      });
    });
  });
});
