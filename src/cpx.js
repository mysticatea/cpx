import {EventEmitter} from "events";
import {dirname, join as joinPath} from "path";
import {unlink, unlinkSync, rmdir, rmdirSync} from "fs";
import mkdir, {sync as mkdirSync} from "mkdirp";
import {Minimatch} from "minimatch";
import {Glob, sync as searchSync} from "glob";
import getBasePath from "glob2base";
import {watch as createWatcher} from "chokidar";
import * as cp from "./copy";
import {assert, assertType, assertTypeOpt} from "./utils";
import Queue from "./queue";

const SOURCE = Symbol("source");
const OUT_DIR = Symbol("outDir");
const TRANSFORM = Symbol("transform");
const QUEUE = Symbol("queue");
const WATCHER = Symbol("watcher");

// Glob is not supported delimiters of Windows.
function normalizePath(path) {
  if (path == null) {
    return null;
  }
  path = path.replace(/\\/g, "/").trim();
  if (/\/$/.test(path)) {
    path = path.slice(0, -1);
  }
  return path;
}

// Call the action for every files that matches the pattern.
function doAllSimply(cpx, pattern, action) {
  new Glob(pattern, {nodir: true, silent: true})
    .on("match", action.bind(cpx));
}

// Call the action for every files that matches the pattern.
function doAll(cpx, pattern, action, cb) {
  if (cb == null) {
    doAllSimply(cpx, pattern, action);
    return;
  }

  let count = 0;
  let done = false;
  let lastError = null;
  const cbIfEnd = () => {
    if (done && count === 0) { cb(lastError); }
  };

  new Glob(pattern, {nodir: true, silent: true})
    .on("match", path => {
      if (lastError != null) { return; }

      count += 1;
      action.call(cpx, path, err => {
        count -= 1;
        lastError = lastError || err;
        cbIfEnd();
      });
    })
    .on("end", () => {
      done = true;
      cbIfEnd();
    })
    .on("error", err => {
      lastError = lastError || err;
    });
}

export default class Cpx extends EventEmitter {
  /**
   * @param {string} source - A blob for copy files.
   * @param {string} outDir - A file path for the destination directory.
   */
  constructor(source, outDir, options) {
    assertType(source, "source", "string");
    assertType(outDir, "outDir", "string");
    super();

    const transforms = [].concat(options && options.transform).filter(Boolean);
    transforms.forEach(t => assertType(t, "transform", "function"));

    this[SOURCE] = normalizePath(source);
    this[OUT_DIR] = normalizePath(outDir);
    this[TRANSFORM] = transforms;
    this[QUEUE] = new Queue();
    this[WATCHER] = null;
  }

  //============================================================================
  // Commons
  //----------------------------------------------------------------------------

  /**
   * The source file glob to copy.
   * @type {string}
   */
  get source() {
    return this[SOURCE];
  }

  /**
   * The destination directory to copy.
   * @type {string}
   */
  get outDir() {
    return this[OUT_DIR];
  }

  /**
   * The factories of transform streams.
   * @type {function[]}
   */
  get transformFactories() {
    return this[TRANSFORM];
  }

  /**
   * The base directory of `this.source`.
   * @type {string}
   */
  get base() {
    const value = normalizePath(getBasePath(new Glob(this.source)));
    Object.defineProperty(this, "base", {value, configurable: true});
    return value;
  }

  /**
   * Convert a glob from source to destination.
   * @param {string} path
   * @returns {string}
   */
  src2dst(path) {
    assertType(path, "path", "string");
    if (this.base === ".") {
      return joinPath(this.outDir, path);
    }
    return path.replace(this.base, this.outDir);
  }

  /**
   * Copy a file sequentially.
   * @param {string} srcPath
   * @param {cpx~callback} [cb = null]
   */
  enqueueCopy(srcPath, cb = null) {
    assertType(srcPath, "srcPath", "string");
    assertTypeOpt(cb, "cb", "function");

    const dstPath = this.src2dst(srcPath);
    if (dstPath === srcPath) {
      if (cb != null) {
        setImmediate(cb, null);
        return;
      }
    }

    this[QUEUE].push(next => {
      mkdir(dirname(dstPath), next);
    });
    this[QUEUE].push(next => {
      cp.copy(srcPath, dstPath, this.transformFactories, err => {
        if (err == null) {
          this.emit("copy", {srcPath, dstPath});
        }

        next();
        if (cb != null) {
          cb(err || null);
        }
      });
    });
  }

  /**
   * Remove a file sequentially.
   * @param {string} path
   * @param {cpx~callback} [cb = null]
   */
  enqueueRemove(path, cb = null) {
    assertType(path, "path", "string");
    assertTypeOpt(cb, "cb", "function");

    let lastError = null;
    this[QUEUE].push(next => {
      unlink(path, err => {
        if (err == null) {
          this.emit("remove", {path});
        }

        lastError = err;
        next();
      });
    });
    this[QUEUE].push(next => {
      rmdir(dirname(path), () => {
        next();
        if (cb != null) {
          cb(lastError);
        }
      });
    });
  }

  //============================================================================
  // Clean Methods
  //----------------------------------------------------------------------------

  /**
   * Remove all files that matches `this.source` like pattern in `this.dest`
   * directory.
   * @param {cpx~callback} [cb = null]
   */
  clean(cb = null) {
    assertTypeOpt(cb, "cb", "function");

    const dest = this.src2dst(this.source);
    if (dest === this.source) {
      if (cb != null) {
        setImmediate(cb, null);
      }
      return;
    }

    doAll(this, dest, this.enqueueRemove, cb);
  }

  /**
   * Remove all files that matches `this.source` like pattern in `this.dest`
   * directory.
   * @thrpws {Error} IO error.
   */
  cleanSync() {
    const dest = this.src2dst(this.source);
    if (dest === this.source) {
      return;
    }

    let pathes = searchSync(dest, {nodir: true, silent: true});
    pathes.forEach(path => {
      unlinkSync(path);
      try {
        rmdirSync(dirname(path));
      }
      catch (err) {
        if (err.code !== "ENOTEMPTY") {
          throw err;
        }
      }
      this.emit("remove", {path});
    });
  }

  //============================================================================
  // Copy Methods
  //----------------------------------------------------------------------------

  /**
   * Copy all files that matches `this.source` pattern to `this.outDir`.
   * @param {cpx~callback} [cb = null]
   */
  copy(cb = null) {
    assertTypeOpt(cb, "cb", "function");
    doAll(this, this.source, this.enqueueCopy, cb);
  }

  /**
   * Copy all files that matches `this.source` pattern to `this.outDir`.
   * @thrpws {Error} IO error.
   */
  copySync() {
    assert(this.transformFactories.length === 0,
           "Synchronous copy can't use the transform option.");

    let srcPathes = searchSync(this.source, {nodir: true, silent: true});
    srcPathes.forEach(srcPath => {
      let dstPath = this.src2dst(srcPath);
      if (dstPath === srcPath) {
        return; //continue
      }

      mkdirSync(dirname(dstPath));
      cp.copySync(srcPath, dstPath);

      this.emit("copy", {srcPath, dstPath});
    });
  }

  //============================================================================
  // Watch Methods
  //----------------------------------------------------------------------------

  /**
   * Copy all files that matches `this.source` pattern to `this.outDir`.
   * And watch changes in `this.base`, and copy only the file every time.
   * @throws {Error} This had been watching already.
   */
  watch() {
    if (this[WATCHER] != null) {
      throw new Error("InvalidStateError");
    }

    const m = new Minimatch(this.source);
    let firstCopyCount = 0;
    let ready = false;
    const fireReadyIfReady = () => {
      if (ready && firstCopyCount === 0) {
        this.emit("watch-ready");
      }
    };

    this[WATCHER] =
      createWatcher(this.base, {cwd: process.cwd(), persistent: true})
        .on("add", path => {
          path = normalizePath(path);
          if (m.match(path)) {
            if (ready) {
              this.enqueueCopy(path);
            }
            else {
              firstCopyCount += 1;
              this.enqueueCopy(path, () => {
                firstCopyCount -= 1;
                fireReadyIfReady();
              });
            }
          }
        })
        .on("unlink", path => {
          path = normalizePath(path);
          if (m.match(path)) {
            const dstPath = this.src2dst(path);
            if (dstPath !== path) {
              this.enqueueRemove(dstPath);
            }
          }
        })
        .on("change", path => {
          path = normalizePath(path);
          if (m.match(path)) {
            this.enqueueCopy(path);
          }
        })
        .on("ready", () => {
          ready = true;
          fireReadyIfReady();
        })
        .on("error", err => {
          this.emit("watch-error", err);
        });
  }

  /**
   * Stop watching.
   */
  unwatch() {
    if (this[WATCHER] != null) {
      this[WATCHER].close();
      this[WATCHER] = null;
    }
  }

  /**
   * Stop watching.
   */
  close() {
    this.unwatch();
  }
}
