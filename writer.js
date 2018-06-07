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

Writer.prototype._doStreamAction = function _doStreamAction(action, statusInfo, done) {
  if (!this.writeStream) return done();

  const msg = this.buildStatusMessage(statusInfo);

  if (this.writeStream._writableState.ended) {
    this.log.error(`Unable to ${action === 'write' ? 'write to' : action} stream`, msg);
    return done();
  }

  this.writeStream[action](msg, done);
};

Writer.prototype.write = function write(err, statusInfo = {}, done = () => {}) {
  if (err) {
    statusInfo.eventType = 'error';
    statusInfo.message = err.message;
  }

  this._doStreamAction('write', statusInfo, done);
};

Writer.prototype.end = function end(statusInfo = {}, done = () => {}) {
  this._doStreamAction('end', statusInfo, done);
};

module.exports = Writer;
