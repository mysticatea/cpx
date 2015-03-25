# cpx 

[![Build Status](https://travis-ci.org/mysticatea/cpx.svg?branch=master)](https://travis-ci.org/mysticatea/cpx)
[![npm version](https://badge.fury.io/js/cpx.svg)](http://badge.fury.io/js/cpx)

Copy file globs, watching for changes.

This module provides a CLI tool like `cp`, but with watching.


## Installation

```
npm install cpx
```


## Usage

```
Usage: cpx <source> <dest> [options]

  Copy file globs, watching for changes.

    <source>  A file glob of target files.
              e.g. src/**/*.{html,png,jpg}
    <dest>    A path of destination directory.
              e.g. app

Options:

  -c, --command <command>   A command text to transform each file.
  -C, --clean               Clean files that matches <source> like pattern in
                            <dest> directory before the first copying.
  -h, --help                Print usage information
  -t, --transform <name>    A module name to transform each file. cpx lookups
                            the specified name via "require()".
  -v, --verbose             Print copied/removed files.
  -V, --version             Print the version number
  -w, --watch               Watch for files that matches <source>, and copy the
                            file to <dest> every changing.
```


## Example

```
cpx "src/**/*.{html,png,jpg}" app --watch
```

This example will copy html/png/jpg files from `src` directory to `app`
directory, keeping file tree structure.
Whenever the files are changed, copy them.

> Since Bash expands globs, requires to enclose it with double quotes.

You can use together [Browserify](http://browserify.org).

```
cpx "src/**/*.{html,png,jpg}" app -w & watchify src/index.js -o app/index.js
```

You can use shell commands to convert each file.

```
cpx "src/**/*.js" app -w -c "babel --source-maps-inline"
```

You can use the transform packages for Browserify.

```
cpx "src/**/*.js" app -w -t babelify -t uglifyify
```

It maybe can use to add header comment, to optimize images, or etc...


## Node.js API

You can use this module as a node module.

```js
var cpx = require("cpx");
```

### cpx.copy

```ts
cpx.copy(source, dest, options, callback)
cpx.copy(source, dest, callback)
```

- **source** `{string}` -- A file glob of copy targets.
- **dest** `{string}` -- A file path of a destination directory.
- **options** `{object}`
  - **options.clean** `{boolean}` -- A flag to remove files that copied on past before copy.
  - **options.transform** `{((filepath: string) => stream.Transform)[]}` -- Functions that creates a `stream.Transform` object to transform each copying file.
- **callback** `{(err: Error|null) => void}` -- A function that is called at done.

Copy files that matches with `source` glob to `dest` directory.

### cpx.copySync

```ts
cpx.copySync(source, dest, options)
cpx.copySync(source, dest)
```

A synchronous function of `cpx.copy`.

Arguments is almost same as `cpx.copy`.
But `options.transform` is not supported.

### cpx.watch

```ts
cpx.watch(source, dest, options)
cpx.watch(source, dest)
```

Copy files that matches with `source` glob string to `dest` directory.
After the first copy, starts observing.  And copy the files when every changes.

Arguments is same as `cpx.copy`.

`cpx.watch` returns an `EventEmitter`.

- `.on("copy", (e) => { ... })` : Be fired after file is copied. `e.srcPath` is a path of original file. `e.dstPath` is a path of new file.
- `.on("remove", (e) => { ... })` : Be fired after file is removed. `e.path` is a path of removed file.
- `.on("watch-raedy", () => { ... })` : Be fired when started watching files, after the first copying.
- `.on("watch-error", (err) => { ... })` : Be fired when occured errors during watching.
