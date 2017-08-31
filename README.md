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
app.rootDir = require('path').join(__dirname);

carpenterd(app)
  .start(carpenterd.worker);

```


[carpenterd]: https://github.com/godaddy/carpenterd
