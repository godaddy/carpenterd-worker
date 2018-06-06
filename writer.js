const nsqStream = require('nsq-stream');

function Writer(opts = {}) {
  const { writer, topic, spec = {}, log } = opts;
  this.log = log;
  this.writeStream = writer && topic && nsqStream.createWriteStream(writer, topic);
  this.spec = spec;
}

Writer.prototype.buildStatusMessage = function buildStatusMessage(statusInfo) {
  const { type: buildType, ...other } = this.spec;
  return {
    ...statusInfo,
    ...other,
    buildType
  };
};

Writer.prototype.write = function write(statusInfo, done = () => {}) {
  if (!this.writeStream) return done();

  const msg = this.buildStatusMessage(statusInfo);

  if (this.writeStream._writableState.ended) {
    this.log.error('Unable to write to stream', msg);
    return done();
  }

  this.writeStream.write(msg, done);
};

Writer.prototype.end = function end(statusInfo, done = () => {}) {
  if (!this.writeStream) return done();

  this.writeStream.end(this.buildStatusMessage(statusInfo), done);
};

module.exports = Writer;
