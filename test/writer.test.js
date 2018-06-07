/* eslint max-nested-callbacks: 0 */
const Writer = require('../writer');
const assume = require('assume');
const sinon = require('sinon');
const nsqStream = require('nsq-stream');
assume.use(require('assume-sinon'));

describe('Writer', function () {
  let sandbox, mockNsqWriter, mockWriteStream;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    mockNsqWriter = { publish: sandbox.stub() }; // Not an accurate stub, just a placeholder

    mockWriteStream = {
      write: sandbox.stub().yields(),
      end: sandbox.stub().yields(),
      _writableState: {}
    };

    sandbox.stub(nsqStream, 'createWriteStream').returns(mockWriteStream);
  });

  afterEach(function () {
    sandbox.restore();
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

    beforeEach(function () {
      mockLog = { error: sandbox.stub() };
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
        sandbox.stub(writer, 'buildStatusMessage');

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

      it('writes an error if it is passed an error object', function (done) {
        writer.write(
          new Error('Penguins are flying'),
          {
            eventType: 'event',
            message: 'Penguins grounded'
          },
          function () {
            assume(writer.writeStream.write).calledWith(sinon.match({
              eventType: 'error',
              name: 'package-name',
              env: 'dev',
              version: '1.2.3',
              locale: 'en-US',
              buildType: 'webpack',
              message: 'Penguins are flying'
            }, sinon.match.func));

            done();
          });
      });

      it('writes the message to the stream', function (done) {
        writer.write(null, { eventType: 'event' }, function () {
          assume(writer.writeStream.write).calledWith(sinon.match({
            eventType: 'event',
            name: 'package-name',
            env: 'dev',
            version: '1.2.3',
            locale: 'en-US',
            buildType: 'webpack'
          }, sinon.match.func));

          done();
        });
      });
    });

    describe('end', function () {
      it('noops without a writeStream', function (done) {
        writer.writeStream = null;
        sandbox.stub(writer, 'buildStatusMessage');

        writer.end({ eventType: 'complete' }, function () {
          assume(writer.buildStatusMessage).not.called();
          done();
        });
      });

      it('logs an error if the stream is no longer writable', function (done) {
        writer.writeStream._writableState.ended = true;

        writer.end({ eventType: 'complete' }, function () {
          assume(mockLog.error).calledWith('Unable to end stream', sinon.match.object);
          done();
        });
      });

      it('ends the stream with the given message', function (done) {
        writer.end({ eventType: 'complete' }, function () {
          assume(writer.writeStream.end).calledWith(sinon.match({
            eventType: 'complete',
            name: 'package-name',
            env: 'dev',
            version: '1.2.3',
            locale: 'en-US',
            buildType: 'webpack'
          }, sinon.match.func));

          done();
        });
      });
    });
  });
});
