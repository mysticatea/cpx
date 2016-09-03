/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */

"use strict"

const {EventEmitter} = require("events")
const {unlink, unlinkSync, rmdir, rmdirSync} = require("fs")
const {
    dirname,
    resolve: resolvePath,
    relative: relativePath,
    join: joinPath,
} = require("path")
const assert = require("assert")
const {watch: createWatcher} = require("chokidar")
const {Glob, sync: searchSync} = require("glob")
const getBasePath = require("glob2base")
const mkdir = require("mkdirp")
const mkdirSync = mkdir.sync
const {Minimatch} = require("minimatch")
const copyFile = require("./copy")
const copyFileSync = require("./copy-sync")
const Queue = require("./queue")

const BASE_DIR = Symbol("baseDir")
const DEREFERENCE = Symbol("dereference")
const OUT_DIR = Symbol("outDir")
const PRESERVE = Symbol("preserve")
const SOURCE = Symbol("source")
const TRANSFORM = Symbol("transform")
const QUEUE = Symbol("queue")
const WATCHER = Symbol("watcher")

/**
 * Converts a file path to use glob.
 * Glob doesn't support the delimiter of Windows.
 *
 * @param {string} path - A path to convert.
 * @returns {string} The normalized path.
 */
function normalizePath(path) {
    if (path == null) {
        return null
    }

    let normalizedPath = relativePath(process.cwd(), resolvePath(path))
    normalizedPath = normalizedPath.replace(/\\/g, "/")
    if (/\/$/.test(normalizedPath)) {
        normalizedPath = normalizedPath.slice(0, -1)
    }
    return normalizedPath || "."
}

/**
 * Applys a given action for each file that matches with a given pattern.
 *
 * @param {Cpx} cpx - An instance.
 * @param {string} pattern - A pattern to find files.
 * @param {function} action - A predicate function to apply.
 * @returns {void}
 */
function doAllSimply(cpx, pattern, action) {
    new Glob(pattern, {nodir: true, silent: true})
        .on("match", action.bind(cpx))
}

/**
 * Applys a given action for each file that matches with a given pattern.
 * Then calls a given callback function after done.
 *
 * @param {Cpx} cpx - An instance.
 * @param {string} pattern - A pattern to find files.
 * @param {function} action - A predicate function to apply.
 * @param {function} cb - A callback function.
 * @returns {void}
 */
function doAll(cpx, pattern, action, cb) {
    if (cb == null) {
        doAllSimply(cpx, pattern, action)
        return
    }

    let count = 0
    let done = false
    let lastError = null

    /**
     * Calls the callback function if done.
     * @returns {void}
     */
    function cbIfEnd() {
        if (done && count === 0) {
            cb(lastError)
        }
    }

    new Glob(pattern, {nodir: true, silent: true, follow: cpx.dereference})
        .on("match", (path) => {
            if (lastError != null) {
                return
            }

            count += 1
            action.call(cpx, path, (err) => {
                count -= 1
                lastError = lastError || err
                cbIfEnd()
            })
        })
        .on("end", () => {
            done = true
            cbIfEnd()
        })
        .on("error", (err) => {
            lastError = lastError || err
        })
}

module.exports = class Cpx extends EventEmitter {
    /**
     * @param {string} source - A blob for copy files.
     * @param {string} outDir - A file path for the destination directory.
     * @param {object} options - An options object.
     */
    constructor(source, outDir, options) {
        assert(typeof source === "string")
        assert(typeof outDir === "string")
        options = options || {} // eslint-disable-line no-param-reassign

        super()

        this[SOURCE] = normalizePath(source)
        this[OUT_DIR] = normalizePath(outDir)
        this[DEREFERENCE] = Boolean(options.dereference)
        this[PRESERVE] = Boolean(options.preserve)
        this[TRANSFORM] = [].concat(options.transform).filter(Boolean)
        this[QUEUE] = new Queue()
        this[BASE_DIR] = null
        this[WATCHER] = null
    }

    //==========================================================================
    // Commons
    //--------------------------------------------------------------------------

    /**
     * The source file glob to copy.
     * @type {string}
     */
    get source() {
        return this[SOURCE]
    }

    /**
     * The destination directory to copy.
     * @type {string}
     */
    get outDir() {
        return this[OUT_DIR]
    }

    /**
     * The flag to follow symbolic links.
     * @type {boolean}
     */
    get dereference() {
        return this[DEREFERENCE]
    }

    /**
     * The flag to copy file attributes.
     * @type {boolean}
     */
    get preserve() {
        return this[PRESERVE]
    }

    /**
     * The factories of transform streams.
     * @type {function[]}
     */
    get transformFactories() {
        return this[TRANSFORM]
    }

    /**
     * The base directory of `this.source`.
     * @type {string}
     */
    get base() {
        if (this[BASE_DIR] == null) {
            this[BASE_DIR] = normalizePath(getBasePath(new Glob(this.source)))
        }
        return this[BASE_DIR]
    }

    /**
     * Convert a glob from source to destination.
     *
     * @param {string} path - A path to convert.
     * @returns {string} The converted path.
     */
    src2dst(path) {
        assert(typeof path === "string")

        if (this.base === ".") {
            return joinPath(this.outDir, path)
        }
        return path.replace(this.base, this.outDir)
    }

    /**
     * Copy a file.
     *
     * @param {string} srcPath - A file path to copy.
     * @param {function} [cb = null] - A callback function.
     * @returns {void}
     */
    enqueueCopy(srcPath, cb = null) {
        assert(typeof srcPath === "string")
        assert(cb == null || typeof cb === "function")

        const dstPath = this.src2dst(srcPath)
        if (dstPath === srcPath) {
            if (cb != null) {
                setImmediate(cb, null)
                return
            }
        }

        this[QUEUE].push(next => {
            mkdir(dirname(dstPath), next)
        })
        this[QUEUE].push(next => {
            copyFile(
                srcPath,
                dstPath,
                this,
                (err) => {
                    if (err == null) {
                        this.emit("copy", {srcPath, dstPath})
                    }

                    next()
                    if (cb != null) {
                        cb(err || null)
                    }
                }
            )
        })
    }

    /**
     * Remove a file.
     *
     * @param {string} path - A file path to remove.
     * @param {function} [cb = null] - A callback function.
     * @returns {void}
     */
    enqueueRemove(path, cb = null) {
        assert(typeof path === "string")
        assert(cb == null || typeof cb === "function")

        let lastError = null
        this[QUEUE].push(next => {
            unlink(path, (err) => {
                if (err == null) {
                    this.emit("remove", {path})
                }

                lastError = err
                next()
            })
        })
        this[QUEUE].push(next => {
            rmdir(dirname(path), () => {
                next()
                if (cb != null) {
                    cb(lastError)
                }
            })
        })
    }

    //==========================================================================
    // Clean Methods
    //--------------------------------------------------------------------------

    /**
     * Remove all files that matches `this.source` like pattern in `this.dest`
     * directory.
     * @param {function} [cb = null] - A callback function.
     * @returns {void}
     */
    clean(cb = null) {
        assert(cb == null || typeof cb === "function")

        const dest = this.src2dst(this.source)
        if (dest === this.source) {
            if (cb != null) {
                setImmediate(cb, null)
            }
            return
        }

        doAll(this, dest, this.enqueueRemove, cb)
    }

    /**
     * Remove all files that matches `this.source` like pattern in `this.dest`
     * directory.
     * @returns {void}
     * @thrpws {Error} IO error.
     */
    cleanSync() {
        const dest = this.src2dst(this.source)
        if (dest === this.source) {
            return
        }

        for (const path of searchSync(dest, {nodir: true, silent: true})) {
            unlinkSync(path)
            try {
                rmdirSync(dirname(path))
            }
            catch (err) {
                if (err.code !== "ENOTEMPTY") {
                    throw err
                }
            }
            this.emit("remove", {path})
        }
    }

    //============================================================================
    // Copy Methods
    //----------------------------------------------------------------------------

    /**
     * Copy all files that matches `this.source` pattern to `this.outDir`.
     *
     * @param {function} [cb = null] - A callback function.
     * @returns {void}
     */
    copy(cb = null) {
        assert(cb == null || typeof cb === "function")

        doAll(this, this.source, this.enqueueCopy, cb)
    }

    /**
     * Copy all files that matches `this.source` pattern to `this.outDir`.
     *
     * @returns {void}
     * @thrpws {Error} IO error.
     */
    copySync() {
        if (this.transformFactories.length > 0) {
            throw new Error("Synchronous copy can't use the transform option.")
        }

        const srcPaths = searchSync(
            this.source,
            {nodir: true, silent: true, follow: this.dereference}
        )
        srcPaths.forEach(srcPath => {
            const dstPath = this.src2dst(srcPath)
            if (dstPath === srcPath) {
                return
            }

            mkdirSync(dirname(dstPath))
            copyFileSync(srcPath, dstPath, this)

            this.emit("copy", {srcPath, dstPath})
        })
    }

    //============================================================================
    // Watch Methods
    //----------------------------------------------------------------------------

    /**
     * Copy all files that matches `this.source` pattern to `this.outDir`.
     * And watch changes in `this.base`, and copy only the file every time.
     *
     * @returns {void}
     * @throws {Error} This had been watching already.
     */
    watch() {
        if (this[WATCHER] != null) {
            throw new Error("InvalidStateError")
        }

        const m = new Minimatch(this.source)
        let firstCopyCount = 0
        let ready = false
        const fireReadyIfReady = () => {
            if (ready && firstCopyCount === 0) {
                this.emit("watch-ready")
            }
        }

        this[WATCHER] = createWatcher(
            this.base,
            {
                cwd: process.cwd(),
                persistent: true,
                followSymlinks: this.dereference,
            }
        )
        this[WATCHER]
            .on("add", (path) => {
                const normalizedPath = normalizePath(path)
                if (m.match(normalizedPath)) {
                    if (ready) {
                        this.enqueueCopy(normalizedPath)
                    }
                    else {
                        firstCopyCount += 1
                        this.enqueueCopy(normalizedPath, () => {
                            firstCopyCount -= 1
                            fireReadyIfReady()
                        })
                    }
                }
            })
            .on("unlink", (path) => {
                const normalizedPath = normalizePath(path)
                if (m.match(normalizedPath)) {
                    const dstPath = this.src2dst(normalizedPath)
                    if (dstPath !== normalizedPath) {
                        this.enqueueRemove(dstPath)
                    }
                }
            })
            .on("change", (path) => {
                const normalizedPath = normalizePath(path)
                if (m.match(normalizedPath)) {
                    this.enqueueCopy(normalizedPath)
                }
            })
            .on("ready", () => {
                ready = true
                fireReadyIfReady()
            })
            .on("error", (err) => {
                this.emit("watch-error", err)
            })
    }

    /**
     * Stop watching.
     *
     * @returns {void}
     */
    unwatch() {
        if (this[WATCHER] != null) {
            this[WATCHER].close()
            this[WATCHER] = null
        }
    }

    /**
     * Stop watching.
     *
     * @returns {void}
     */
    close() {
        this.unwatch()
    }
}
