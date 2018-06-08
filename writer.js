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
  return {
    ...statusInfo,
    ...other,
    buildType
  };
};

/**
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
 * @function write
 * @param {Error} err - Error object for unsuccessful actions
 * @param {Object} statusInfo - Status information
 * @param {Function} done - Callback
 * @api public
 */
Writer.prototype.write = function write(err, statusInfo = {}, done = () => {}) {
  if (err) {
    statusInfo.eventType = 'error';
    statusInfo.message = err.message;
  }

  this._doStreamAction('write', statusInfo, done);
};

/**
 * @function end
 * @param {Object} statusInfo - Status information
 * @param {Function} done - Callback
 * @api public
 */
Writer.prototype.end = function end(statusInfo = {}, done = () => {}) {
  this._doStreamAction('end', statusInfo, done);
};

module.exports = Writer;
