# cpx

Copy file globs, watching for changes.

This module provides a CLI tool like `cp`, but with watching.

## Installation

```
npm install cpx
```

## Usage

```
Usage: cpx <source> <dest> [options]

  copy file globs, watching for changes.

  <source>: target file globs.
            e.g. src/**/*.{html,png,jpg}
  <dest>:   a path of destination directory.
            e.g. app

Options:

  -h, --help     output usage information
  -V, --version  output the version number
  --clean        clean files that matches <source> pattern in <dest> directory before copying.
  -w, --watch    watch for files that matches <source> pattern, then copy to <dest> on changed.
  -v, --verbose  print copied/removed files.
```

## Example

```
cpx src/**/*.{html,png,jpg} app --watch
```

This example will copy html/png/jpg files from `src` directory to `app` directory, keeping file tree structure.
And every time the files are changed, copy them.

You can use together [Browserify](http://browserify.org).

```
cpx src/**/*.{html,png,jpg} app -w & watchify src/index.js -o app/index.js
```

## Node.js API

You can use this module as a node module.

```js
var cpx = require("cpx");
```

```ts
cpx.copy(source: string, dest: string, cb?: (err: Error|null) => void): cpx.Cpx
```

Copy files that matches with `source` glob string to `dest` directory.

```ts
cpx.copySync(source: string, dest: string): void
```

A synchronous function of `cpx.copy`.

```ts
cpx.watch(source: string, dest: string): cpx.Cpx
```

Copy files that matches with `source` glob string to `dest` directory.

Class `cpx.Cpx`

`cpx.Cpx` is `EventEmitter`.

- `.on("copy", (e) => { ... })` : Be fired after file is copied. `e.srcPath` is a path of original file. `e.dstPath` is a path of new file.
- `.on("remove", (e) => { ... })` : Be fired after file is removed. `e.path` is a path of removed file.
- `.on("watch-raedy", () => { ... })` : Be fired when started watching files, after the first copying.
- `.on("watch-error", (err) => { ... })` : Be fired when occured errors during watching.
