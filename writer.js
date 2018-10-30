const { performance } = require('perf_hooks');
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
  this.timings = new Map();
}

/**
 * Starts a timer for the given key, if additional arguments are provided, also writes a status message
 * @param {String} key - Timing key to associate with the timer
 * @param {...Any} rest - Additional arguments used to call write (not including a timer key)
 */
Writer.prototype.timerStart = function timerStart(key, ...rest) {
  this.timings.set(key, performance.now());
  if (rest && rest.length > 0) {
    this.write(null, ...rest);
  }
};

/**
 * Combines the spec with status information
 *
 * @function buildStatusMessage
 * @param {String?} key - Timing key to use, if one exists, timing information will
 * be added to the status message
 * @param {Object} statusInfo - Status information
 * @returns {Object} - The combined message object
 * @api private
 */
Writer.prototype.buildStatusMessage = function buildStatusMessage(key, statusInfo) {
  const { type: buildType, ...other } = this.spec;

  if (statusInfo.error) {
    statusInfo.eventType = 'error';
    statusInfo.message = statusInfo.error.message;
    statusInfo.details = statusInfo.error.output;
    delete statusInfo.error;
  }

  if (key) {
    other.timing = performance.now() - this.timings.get(key);
    this.timings.delete(key);
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
 * @param {String?} key - Timing key to use, if one exists, timing information will
 * be added to the status message
 * @param {Object} statusInfo - Status information
 * @param {Function} done - Callback
 * @returns {undefined}
 * @api private
 */
Writer.prototype._doStreamAction = function _doStreamAction(action, key, statusInfo, done) {
  if (!this.writeStream) return done();

  const msg = this.buildStatusMessage(key, statusInfo);

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
 * @param {String?} key - Timing key to use, if one exists, timing information will
 * be added to the status message
 * @param {Object} statusInfo - Status information
 * @param {Function} done - Callback
 * @api public
 */
Writer.prototype.write = function write(key, statusInfo = {}, done = () => {}) {
  this._doStreamAction('write', key, statusInfo, done);
};

/**
 * End the stream and write a final message
 *
 * @function end
 * @param {String?} key - Timing key to use, if one exists, timing information will
 * be added to the status message
 * @param {Object} statusInfo - Status information
 * @param {Function} done - Callback
 * @api public
 */
Writer.prototype.end = function end(key, statusInfo = {}, done = () => {}) {
  this._doStreamAction('end', key, statusInfo, done);
};

module.exports = Writer;
