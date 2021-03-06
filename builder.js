const parallel = require('parallel-transform');
const workers = require('workers-factory');
const Bffs = require('bffs');
const async = require('async');
const path = require('path');
const failure = require('failure');
const uuid = require('uuid');
const rmrf = require('./rmrf');
const mkdirp = require('mkdirp');
const once = require('one-time');
const pkgcloud = require('pkgcloud');
const semver = require('semver');
const fs = require('fs');
const retry = require('retryme');
const ms = require('millisecond');
const Writer = require('./writer');
const rip = require('rip-out');

// short -> long
const envs = new Map([
  ['dev', 'development'],
  ['test', 'test'],
  ['prod', 'production']
]);

const assign = Object.assign;

module.exports = Builder;

/**
 * @constructor
 * @param {Object} opts - options for the builder
 */
function Builder(opts = {}) {
  this.log = opts.log;
  this.bucket = opts.bucket;
  this.pkgcloud = pkgcloud.storage.createClient(
    opts.pkgcloud || {}
  );
  this.retry = opts.retry || {};
  this.assets = new Bffs(assign({
    models: opts.models,
    db: opts.database
  }, opts.assets || {}));
  this.models = opts.models;
  this.conc = opts.concurrency || 2;
  this._paths = opts.paths;
  this.status = opts.status || {};
  this._purge = opts.purge || {};
  this._purge.interval = this._purge.interval || ms('30min');
  this._purge.age = this._purge.age || ms('20min');

  if (opts.env !== 'development') setInterval(
    this.purge.bind(this),
    this._purge.interval
  ).unref();
}

/**
 * Build the given specification and publish it to ceph
 *
 * @function build
 * @param {Object} spec - specification of the build being run
 * @param {Function} callback - continuation function
 * @api public
 */
Builder.prototype.build = function build(spec, callback) {
  const statusKey = 'build';
  this.log.info('Received message', spec);
  if (!spec) {
    const err = failure('No spec to build');
    process.nextTick(callback, err);
    return;
  }

  const { writer, topic } = this.status;
  const writeStream = new Writer({ writer, topic, spec, log: this.log });

  for (const prop of ['name', 'env']) {
    if (!spec[prop]) {
      const err = failure(`${prop} not specified`);
      writeStream.end(statusKey, err, callback.bind(null, err));
      return;
    }
  }

  if (!semver.valid(spec.version)) {
    const err = failure('Invalid version specified');
    writeStream.end(statusKey, err, callback.bind(null, err));
    return;
  }

  const promote = spec.promote !== false;
  spec = rip(spec, 'promote');
  const id = uuid();
  const paths = this.paths(spec, id);
  this.log.profile(`${id}-init`);

  //
  // Check to see if we actually need to run this build
  //
  const cleanup = () => {
    this.cleanup(paths.root, () => this.log.info(`Remove dir ${paths.root} ok`));
  };
  writeStream.timerStart(statusKey);
  this.check(id, spec, (checkError) => {
    if (checkError && checkError.skip) return callback();
    async.series({
      mkdirp: this.mkdirp.bind(this, paths, writeStream),
      tarball: this.tarball.bind(this, spec, paths.tarball, writeStream),
      build: this._build.bind(this, id, spec, paths, writeStream)
    }, (error, results) => {
      if (error) return writeStream.end(statusKey, { error }, callback.bind(null, error));

      const publishKey = 'Publish assets';
      this.log.info('publish assets', spec);
      this.log.profile(`${id}-publish`);
      writeStream.timerStart(publishKey);

      this.assets.publish(
        spec,
        Object.assign({ promote }, results.build),
        (publishError) => {
          this.log.profile(`${id}-publish`, 'Publish assets time', assign({}, spec));

          if (publishError) {
            cleanup();
            return writeStream.end(publishKey, { error: publishError }, callback.bind(null, publishError));
          }

          this.log.profile(`${id}-init`, 'Total execution time', assign({}, spec));

          writeStream.write(publishKey, {
            eventType: 'event',
            message: 'Assets published'
          });

          //
          // Cleanup?
          // - We possibly want to reuse tarballs to prevent repeated fetching of
          //   the same version. We might want to wait a day? or x number of hours
          //   to do cleanup
          // UPDATE: Due to the possible concurrent nature of builds we cant rely
          // on trying to read a possible existing file before its done being
          // written (referring to fetching tarballs). in the future we should
          // look back into this optimization. It will require us to have a global
          // cache that defines fetching state so we can cleanly wait and use the
          // file that is already in process of downloading or the file that has
          // already been downloaded
          //
          cleanup();

          writeStream.end(statusKey, {
            eventType: 'complete',
            message: 'carpenterd-worker build completed'
          }, callback);
        });
    });
  });
};

/**
 * Check to see if the build exists or not
 *
 * @function check
 * @param {String} id - id assigned for this build
 * @param {Object} spec - specification for the build
 * @param {Function} next - continue build process
 * @api private
 */
Builder.prototype.check = function (id, spec, next) {
  const BuildHead = this.models.BuildHead;

  const logId = `${id}-check`;
  this.log.profile(logId);
  BuildHead.findOne(spec, (err, head) => {
    this.log.profile(logId, 'Check complete');
    // We should still try and build even if it errors
    if (err) return next();
    // If there is no build we definitely need to run it
    if (!head) return next();
    // If the build already exists then skip it
    if (head.version === spec.version) return next(failure('equal versions', { skip: true }));

    // TODO: Consider in cases where there is a spec less than the head version
    // but no `build` version to modify the spec or signal a different kind of
    // publish to happen so that the HEAD isnt replaced but the `build` is
    // created

    // if the spec version is smaller than the current head, skip it
    if (semver.lt(spec.version, head.version)) return next(failure('old version', { skip: true }));
    // Otherwise its out of date and we need to build it
    next();
  });
};

/**
 * Cleanup the given directory
 *
 * @function cleanup
 * @param {String} root - root directory
 * @param {Function} next - continuation function
 * @returns {undefined}
 * @api private
 *
 */
Builder.prototype.cleanup = function clean(root, next) {
  return void rmrf(root, next);
};

/**
 * Run the webpack build for the given parameters
 *
 * @function _build
 * @param {String} id - unique identifier for this build
 * @param {Object} spec - specification for build
 * @param {Object} paths - object of paths used for build
 * @param {Object} writer - writable stream for nsq status data
 * @param {Function} fn - continuation function to call when finished
 * @returns {undefined}
 * @api private
 */
Builder.prototype._build = function _build(id, spec, paths, writer, fn) { // eslint-disable-line max-params
  //
  // TODO: refactor workers-factory to have sane options
  //
  const type = spec.type || 'webpack';
  const statusKey = 'build';

  const logId = `${id}-${type}-build`;
  const opts = {
    id: id,
    name: spec.name,
    source: paths.root,
    target: paths.root,
    destDir: paths.publish,
    content: paths.tarball,
    env: spec.env,
    //
    // We need this for retries
    //
    clean: true,
    processEnv: assign({}, process.env, {
      // This matters for image URLs
      NODE_ENV: envs.get(spec.env),
      LOCALE: spec.locale,
      WRHS_LOCALE: spec.locale
    })
  };

  writer.timerStart(statusKey, {
    eventType: 'event',
    message: `${type} build start`
  });
  const factory = workers[type];
  const op = retry.op(this.retry);
  return void op.attempt(next => {
    this.log.profile(logId);
    return void factory(opts, (err, results) => {
      this.log.profile(logId, 'Webpack build', assign({}, spec));
      next(err, results);
    });
  }, function (err) {
    writer.write(statusKey, {
      error: err,
      eventType: 'event',
      message: `${type} build completed`
    });

    fn(...arguments);
  });
};

/**
 * Fetch the tarball
 *
 * @function tarball
 * @param {Object} spec - specification for build
 * @param {String} tarpath - path to write the tarball
 * @param {Object} writer - writable stream for nsq status data
 * @param {Function} fn - continuation function to call when finished
 * @returns {undefined} Nothing
 * @api private
 */
Builder.prototype.tarball = function tarball(spec, tarpath, writer, fn) {
  const statusKey = 'tarball';
  writer.timerStart(statusKey);
  const op = retry.op(this.retry);
  return void op.attempt(next => {
    const done = once(next);
    const id = `${encodeURIComponent(spec.name)}-${spec.version}.tgz`;
    this.log.info('Fetch tarball', { bucket: this.bucket, id: id });
    this.log.profile(tarpath);

    this.pkgcloud.download({
      container: this.bucket,
      remote: id
    })
      .on('error', done)
      .pipe(fs.createWriteStream(tarpath))
      .once('error', done)
      .once('finish', () => {
        this.log.profile(tarpath, 'Fetch tarball finish', assign({}, spec));
        done();
      });
  }, function (err) {
    writer.write(statusKey, {
      error: err,
      eventType: 'event',
      message: 'Fetched tarball'
    });

    fn(...arguments);
  });
};

/**
 * Make all required directories
 *
 * @function mkdirp
 * @param {Object} paths - object that contains paths for this build
 * @param {Object} writer - writable stream for nsq status data
 * @param {Function} next - continuation function called when completed
 * @api private
 */
Builder.prototype.mkdirp = function mkdirpp(paths, writer, next) {
  //
  // Only need to run this on publish because its nested within root
  //
  mkdirp(paths.publish, next);
};

/**
 * Return an object of paths to use for the build
 *
 * @function paths
 * @param {Object} spec - specification for build
 * @param {String} uid - unique identifier for build
 * @returns {Object} paths
 * @api private
 */
Builder.prototype.paths = function paths(spec, uid) {
  const p = Object.create(null);
  const pathSpec = assign({}, spec, { name: spec.name.replace('/', '-') });
  const base = this.assets.key(pathSpec).replace(new RegExp('!', 'g'), '-');
  //
  // Ensure no collisions. In the future we can optimize to reduce fetching of
  // tarballs etc but if we are potentiall running concurrent builds on
  // a single worker, we cant have them try to read partial data or conflict in
  // reading the same data sources
  //
  p.root = path.join(this._paths.root, base, uid || uuid());
  p.publish = path.join(p.root, 'publish');
  p.tarball = path.join(p.root, `${pathSpec.name}-${spec.version}.tgz`);
  return p;
};

/**
 * Purge the old files/folders used for builds
 *
 * @function purge
 * @param {Function} done - optional callback
 * @returns {undefined}
 * @api private
 */
Builder.prototype.purge = function purge(done) {
  const self = this;
  const age = this._purge.age; // this could be configured
  const target = this._paths.root;

  function finish(err, message) {
    if (err) self.log.error(err);
    if (message) self.log.info(message);
    if (done) return done(err);
  }

  fs.readdir(target, (readdirError, files) => {
    if (readdirError) return finish(`Failed to read dir ${target} for cleanup`);
    if (!files) return finish(null, 'No files to purge');

    async.reduce(files, 0, (i, file, next) => {
      const filepath = path.join(target, file);
      fs.stat(filepath, (err, stat) => {
        if (err) return void next(err);

        //
        // Be defensive and use modified time to determine if the folder is older
        // than the defined age
        //
        if (Date.now() - age <= new Date(stat.mtime).getTime()) {
          return next(null, i);
        }

        return void rmrf(filepath, (rmError) => {
          next(rmError, i + 1);
        });
      });
    }, (err, num) => {
      if (err) return finish(err);

      finish(null, `Purged ${num} files from temp build directory`);
    });
  });
};

/**
 * Return a stream that will be able to run builds concurrently
 *
 * @function stream
 * @returns {Stream} concurrent stream for builds
 * @api public
 */
Builder.prototype.stream = function stream() {
  // returns a build stream for incoming messages as each data event
  return parallel(this.conc, (data, cb) => {
    this.build(data, (err) => {
      if (err) this.log.error('Error building: %s', err.message, { logs: err.output, ...data });
      cb(null, data);
    });
  });
};
