# carpenterd-worker

[![Build
Status](https://travis-ci.org/godaddy/carpenterd-worker.svg?branch=master)](https://travis-ci.org/godaddy/carpenterd-worker)

The [`carpenterd`][carpenterd] worker process for executing builds.

## Install

```sh
npm install carpenterd-worker --save
```

## Usage

```js

const carpenterd = require('carpenterd-worker');

const app = new Map();
// Select the directory that contains a `config` directory so that `slay-config`
// works appropriately
app.rootDir = require('path').join(__dirname);

carpenterd(app)
  .start(carpenterd.worker);

```

## Description

`carpenterd-worker` is responsible for receiving job messages from [`carpenterd`][carpenterd], fetching the fully built `npm` tarball from a place like amazon s3, execute the`webpack`/`browserify`/`babel` build using [`workers-factory`][workers-factory].

## Dependencies

- [`nsq`][nsq] for job distribution to all the workers in given cluster.
- amazon s3 or an s3 like store for storing built assets and for fetching tarballs stored by [`carpenterd`][carpenterd].
- A [`cassandra`][cassandra] cluster that is storing the `warehouse.ai` system data.


## Configuration

See the example config `config.example.json` in this repo.

**notes**
- `nsq` config option is for a fork of [`nsq.js`][nsq.js] that has kubernetes support but otherwise has the same options.
  - There is an additional configuration option `statusTopic` for setting the nsq topic that should be written to for status updates.
- `assets.prefix` in the config is the bucket name for where the public CDN assets are uploaded.
- `http` is the http port the healhcheck listens on.
- `npm-tars` the npm tarball bucket to fetch from.
- `datastar` the configuration for cassandra that gets passed directly to [`datastar`][datastar].


## Status-Api

Carpenterd-worker supports posting messages to the [warehouse.ai] status-api via NSQ.
It will post messages to the nsq topic configured at:

```js
{
  // ...other configuration
  "nsq": {
    "statusTopic": "an-nsq-topic", // topic that you choose for the status-api to consume
    // ...other nsq setup
  },
  // ...other configuration
}
```

The NSQ payloads will be object that take the form:

```js
{
    eventType: "event|error|complete", // The type of status event that occurred
    name: "package-name",
    env: "dev", // The environment that is being built
    version: "1.2.3", // The version of the build
    locale: "en-US", // (Optional) The locale that is being built
    buildType: "webpack", // The type of the build (typically just webpack)
    message: "Description of what happened"
  }
```

#### Event Types

In the status-api NSQ payload there is a field called `eventType`. The possible values that carpenterd-worker will send are:

- `event` - Used for interim statuses that a user might care about, but doesn't affect/progress the overall build status
- `complete` - Used to indicate that the build is completed
- `error` - Used to indicate that `carpenterd-worker` encountered an error and wasn't able to queue all the builds

[carpenterd]: https://github.com/godaddy/carpenterd
[workers-factory]: https://github.com/warehouseai/workers-factory
[datastar]: https://github.com/godaddy/datastar
[nsq]: http://nsq.io
[cassandra]: http://cassandra.apache.org/
[nsq.js]: https://github.com/jcrugzz/nsq.js/tree/addr-modify
