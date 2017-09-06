# carpenterd-worker

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
- `assets.prefix` in the config is the bucket name for where the public CDN assets are uploaded.
- `http` is the http port the healhcheck listens on
- `npm-tars` the npm tarball bucket to fetch from
- `datastar` the configuration for cassandra that gets passed directly to [`datastar`][datastar].

[carpenterd]: https://github.com/godaddy/carpenterd
[workers-factory]: https://github.com/warehouseai/workers-factory
[datastar]: https://github.com/godaddy/datastar
[nsq]: http://nsq.io
[cassandra]: http://cassandra.apache.org/
[nsq.js]: https://github.com/jcrugzz/nsq.js/tree/addr-modify

