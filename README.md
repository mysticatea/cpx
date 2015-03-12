# cpx

Copy file globs, watching for changes.

This module provides a CLI tool like `cp`, but with watching.

(This module is dogfooding currently.)


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

  -c, --clean       Clean files that matches <source> like pattern in <dest>
                    directory before the first copying.
  -h, --help        Print usage information
  -t, --transform   A transform module name. cpx lookups the specified name via
                    "require()". You can give "-t" multiple.
  -v, --verbose     Print copied/removed files.
  -V, --version     Print the version number
  -w, --watch       Watch for files that matches <source>, and copy the file to
                    <dest> every changing.
```


## Example

```
cpx src/**/*.{html,png,jpg} app --watch
```

This example will copy html/png/jpg files from `src` directory to `app`
directory, keeping file tree structure.
And every time the files are changed, copy them.

You can use together [Browserify](http://browserify.org).

```
cpx src/**/*.{html,png,jpg} app -w & watchify src/index.js -o app/index.js
```

You can use the transform packages for Browserify.

```
cpx src/**/*.js app -w -t babelify -t uglifyify
```

It maybe can use to add header comment, to optimize images, or etc...


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
