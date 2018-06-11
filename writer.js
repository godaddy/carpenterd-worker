const nsqStream = require('nsq-stream');

/**
 * @constructor
 * @param {Object} opts - options for the writer
 */
function Writer(opts = {}) {
  const { writer, topic, spec = {}, log } = opts;
  this.log = log;
  this.writeStream = writer && topic && nsqStream.createWriteStream(writer, topic);
  this.spec = spec;
}

/**
 * Combines the spec with status information
 *
 * @function buildStatusMessage
 * @param {Object} statusInfo - Status information
 * @returns {Object} - The combined message object
 * @api private
 */
Writer.prototype.buildStatusMessage = function buildStatusMessage(statusInfo) {
  const { type: buildType, ...other } = this.spec;

  if (statusInfo.error) {
    statusInfo.eventType = 'error';
    statusInfo.message = statusInfo.error.message;
    statusInfo.output = statusInfo.error.output;
    delete statusInfo.error;
  }

  return {
    ...statusInfo,
    ...other,
    buildType
  };
};

/**
 * Perform an action on the stream (abscracts 'write' and 'end' so they share logic)
 *
 * @function _doStreamAction
 * @param {String} action - Which stream action execute
 * @param {Object} statusInfo - Status information
 * @param {Function} done - Callback
 * @returns {undefined}
 * @api private
 */
Writer.prototype._doStreamAction = function _doStreamAction(action, statusInfo, done) {
  if (!this.writeStream) return done();

  const msg = this.buildStatusMessage(statusInfo);

  if (this.writeStream._writableState.ended) {
    this.log.error(`Unable to ${action === 'write' ? 'write to' : action} stream`, msg);
    return done();
  }

  this.writeStream[action](msg, done);
};

/**
 * Write to the NSQ stream
 *
 * @function write
 * @param {Object} statusInfo - Status information
 * @param {Function} done - Callback
 * @api public
 */
Writer.prototype.write = function write(statusInfo = {}, done = () => {}) {
  this._doStreamAction('write', statusInfo, done);
};

/**
 * End the stream and write a final message
 *
 * @function end
 * @param {Object} statusInfo - Status information
 * @param {Function} done - Callback
 * @api public
 */
Writer.prototype.end = function end(statusInfo = {}, done = () => {}) {
  this._doStreamAction('end', statusInfo, done);
};

module.exports = Writer;
