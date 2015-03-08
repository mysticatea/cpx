import {EventEmitter} from "events";
import {dirname} from "path";
import {unlink, unlinkSync, rmdir, rmdirSync} from "fs";
import cp, {sync as cpSync} from "cp";
import mkdir, {sync as mkdirSync} from "mkdirp";
import {Minimatch} from "minimatch";
import {Glob, sync as searchSync} from "glob";
import getBasePath from "glob2base";
import {watch as createWatcher} from "chokidar";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertType(value, name, type) {
  if (typeof value !== type) {
    throw new TypeError(`${name} should be a ${type}.`);
  }
}

function assertTypeOpt(value, name, type) {
  if (value != null && typeof value !== type) {
    throw new TypeError(`${name} should be a ${type} or null.`);
  }
}

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

// Process actions in queue sequentially.
function dequeue(cpx, item) {
  item.action(() => {
    if (item.next) {
      dequeue(cpx, item.next);
    }
    else {
      assert(cpx.queue === item, "Why?");
      cpx.queue = null;
    }
  });
}

function doAllSimply(cpx, pattern, action) {
  new Glob(pattern, {nodir: true, silent: true})
    .on("match", action.bind(cpx));
}

function doAll(cpx, pattern, action, cb) {
  if (cb == null) {
    doAllSimply(cpx, pattern, action);
    return;
  }

  let count = 0;
  let done = false;
  let lastError = null;
  let cbIfEnd = () => {
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
  constructor(source, outDir) {
    assertType(source, "source", "string");
    assertType(outDir, "outDir", "string");

    this.source = normalizePath(source);
    this.outDir = normalizePath(outDir);
    this.queues = Object.create(null);
    this.watcher = null;
  }

  // The base directory of `this.source`.
  get base() {
    let value = normalizePath(getBasePath(new Glob(this.source)));
    Object.defineProperty(this, "base", {value, configurable: true});
    return value;
  }

  // Glob patterns that matches on `this.outDir`.
  get dest() {
    let value = this.src2dst(this.source);
    Object.defineProperty(this, "dest", {value, configurable: true});
    return value;
  }

  // Convert a glob pattern from source to destination.
  src2dst(path) {
    assertType(path, "path", "string");
    let value = path.replace(this.base, this.outDir);
    return value;
  }

  // To process files sequentially, add an action to queue.
  enqueue(action) {
    assertType(action, "action", "function");

    let item = {action, next: null};
    if (this.queue != null) {
      this.queue.next = item;
      this.queue = item;
    }
    else {
      this.queue = item;
      dequeue(this, item);
    }
  }

  enqueueCopy(srcPath, cb = null) {
    assertType(srcPath, "srcPath", "string");
    assertTypeOpt(cb, "cb", "function");

    let dstPath = this.src2dst(srcPath);
    if (dstPath === srcPath) {
      if (cb != null) {
        cb(null);
        return;
      }
    }

    this.enqueue(next => {
      mkdir(dirname(dstPath), next);
    });
    this.enqueue(next => {
      cp(srcPath, dstPath, err => {
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

  enqueueRemove(path, cb = null) {
    assertType(path, "path", "string");
    assertTypeOpt(cb, "cb", "function");

    let lastError = null;
    this.enqueue(next => {
      unlink(path, err => {
        if (err == null) {
          this.emit("remove", {path});
        }

        lastError = err;
        next();
      });
    });
    this.enqueue(next => {
      rmdir(dirname(path), () => {
        next();
        if (cb != null) {
          cb(lastError);
        }
      });
    });
  }

  clean(cb) {
    assertTypeOpt(cb, "cb", "function");
    if (this.dest === this.source) {
      if (cb != null) {
        cb(null);
      }
      return;
    }

    doAll(this, this.dest, this.enqueueRemove, cb);
  }

  cleanSync() {
    if (this.dest === this.source) {
      return;
    }

    let pathes = searchSync(this.dest, {nodir: true, silent: true});
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

  copy(cb = null) {
    assertTypeOpt(cb, "cb", "function");
    doAll(this, this.source, this.enqueueCopy, cb);
  }

  copySync() {
    let srcPathes = searchSync(this.source, {nodir: true, silent: true});
    srcPathes.forEach(srcPath => {
      let dstPath = this.src2dst(srcPath);
      if (dstPath === srcPath) {
        return; //continue
      }

      mkdirSync(dirname(dstPath));
      cpSync(srcPath, dstPath);

      this.emit("copy", {srcPath, dstPath});
    });
  }

  watch() {
    this.unwatch();

    const m = new Minimatch(this.source);
    let firstCopyCount = 0;
    let ready = false;
    let fireReadyIfReady = () => {
      if (ready && firstCopyCount === 0) {
        this.emit("watch-ready");
      }
    };

    this.watcher =
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
            let dstPath = this.src2dst(path);
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

  unwatch() {
    if (this.watcher != null) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  close() {
    this.unwatch();
  }
}
