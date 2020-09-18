/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const EventEmitter = require("events").EventEmitter
const path = require("path")
const co = require("co")
const debounce = require("debounce")
const debug = require("debug")("cpx")
const fs = require("fs-extra")
const Minimatch = require("minimatch").Minimatch
const copyFile = require("./copy-file")
const normalizePath = require("./normalize-path")
const removeFile = require("./remove-file")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const walkDirectories = co.wrap(function*(dirRoot, dereference, callback) {
    const stack = []

    // Check whether the root is a directory.
    {
        const stat = yield fs.stat(dirRoot)
        if (!stat.isDirectory()) {
            return
        }
        stack.push({
            path: dirRoot,
            files: new Map(),
        })
    }

    // Walk it recursively.
    while (stack.length > 0) {
        const entry = stack.pop()
        const stat = yield fs.lstat(entry.path)

        if (dereference || !stat.isSymbolicLink()) {
            const children = yield fs.readdir(entry.path)

            for (let i = children.length - 1; i >= 0; --i) {
                const child = children[i]
                const childPath = normalizePath(path.join(entry.path, child))
                const childStat = yield fs.stat(childPath)

                entry.files.set(childPath, childStat)

                if (childStat.isDirectory()) {
                    stack.push({
                        path: childPath,
                        files: new Map(),
                    })
                }
            }
        }

        yield callback(entry.path, entry.files)
    }
})

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

/**
 * Watcher class.
 *
 * The watcher observes files and directories which are matched to the given
 * glob pattern.
 */
module.exports = class Watcher extends EventEmitter {
    /**
     * Initialize this watcher.
     * @param {object} options Normalized options.
     * @param {boolean} options.clean The flag to remove files which are on destination directory.
     * @param {boolean} options.dereference The flag to dereference symbolic links.
     * @param {boolean} options.includeEmptyDirs The flag to copy empty directories.
     * @param {boolean} options.initialCopy The flag to copy files at the first time.
     * @param {string} options.outputDir The path to the output directory.
     * @param {boolean} options.preserve The flag to copy file attributes such as timestamps, users, and groups.
     * @param {string} options.source The glob pattern of source files.
     * @param {(function(string):stream.Transform)[]} options.transform The array of transform function's factories.
     * @param {boolean} options.update The flag to not overwrite newer files.
     */
    constructor(options) {
        super()

        // options
        this.baseDir = options.baseDir
        this.dereference = options.dereference
        this.includeEmptyDirs = options.includeEmptyDirs
        this.initialCopy = options.initialCopy
        this.matcher = new Minimatch(options.source)
        this.outputDir = options.outputDir
        this.preserve = options.preserve
        this.source = options.source
        this.toDestination = options.toDestination
        this.transform = options.transform
        this.update = options.update

        // private state
        this.initialCopyCount = 0
        this.onDoneInitialCopy = () => {
            this.initialCopyCount -= 1
            this.emitReadyEventIfReady()
        }
        this.pending = false
        this.queue = new Map()
        this.ready = false
        this.retries = new Map()
        this.trigger = null
        this.watchers = new Map()
    }

    /**
     * Open this watcher.
     * @returns {void}
     */
    open() {
        debug("Watcher#open")
        this.close()

        this.trigger = debounce(this.onTrigger.bind(this), 250)

        // Start to watch the change of child files for each directory.
        this.addDirectory(this.baseDir)
            .then(() => {
                this.onReady()
            })
            .catch(error => {
                this.onError(error)
            })
    }

    /**
     * Close this watcher.
     * @returns {void}
     */
    close() {
        debug("Watcher#close")
        if (this.trigger != null) {
            this.trigger.clear()
            this.trigger = null
        }
        for (const entry of this.watchers.values()) {
            entry.watcher.close()
        }
        this.watchers.clear()
    }

    /**
     * Start watching the files of the given directory.
     * @param {string} dirRoot The path to the root directory to watch.
     * @returns {Promise<void>} The promise which will go fulfilled after done.
     * @private
     */
    addDirectory(dirRoot) {
        debug("Watcher#addDirectory", dirRoot)
        return walkDirectories(
            dirRoot,
            this.dereference,
            co.wrap(
                function*(dirPath, files) {
                    if (this.trigger == null || this.watchers.has(dirPath)) {
                        return
                    }

                    // Skip the content of symbolic links by default.
                    if (
                        !this.dereference &&
                        (yield fs.lstat(dirPath)).isSymbolicLink()
                    ) {
                        this.onAdded(dirPath)
                        return
                    }

                    // Start watching.
                    const watcher = fs
                        .watch(dirPath)
                        .on("change", (type, filename) => {
                            debug(
                                "Watcher~watcher onchange",
                                type,
                                dirPath,
                                filename
                            )
                            if (filename == null) {
                                return
                            }
                            const sourcePath = normalizePath(
                                path.join(dirPath, filename)
                            )

                            fs.stat(sourcePath).then(
                                stat => {
                                    this.classifyFileChange(
                                        files,
                                        sourcePath,
                                        stat
                                    )
                                },
                                error => {
                                    if (error.code === "ENOENT") {
                                        this.classifyFileChange(
                                            files,
                                            sourcePath,
                                            null
                                        )
                                    } else {
                                        this.onError(error)
                                    }
                                }
                            )
                        })
                        .on("error", error => {
                            debug("Watcher~watcher onerror", dirPath, error)
                            this.removeDirectory(dirPath)
                        })
                    this.watchers.set(dirPath, { watcher, files })

                    // Emit "added" events.
                    this.onAdded(dirPath)
                    for (const entry of files.entries()) {
                        const filePath = entry[0]
                        const stat = entry[1]

                        if (!stat.isDirectory()) {
                            this.onAdded(filePath)
                        }
                    }
                }.bind(this)
            )
        )
    }

    /**
     * Stop watching the files of the given directory.
     * @param {string} dirRoot The path to the root directory to watch.
     * @returns {void}
     * @private
     */
    removeDirectory(dirRoot) {
        debug("Watcher#removeDirectory", dirRoot)
        const stack = [dirRoot]
        const eventStack = []

        while (stack.length > 0) {
            const dirPath = stack.pop()
            const entry = this.watchers.get(dirPath)
            this.watchers.delete(dirPath)

            if (entry == null) {
                continue
            }
            entry.watcher.close()
            eventStack.push(dirPath)

            for (const childEntry of entry.files.entries()) {
                const childPath = childEntry[0]
                const childStat = childEntry[1]

                if (childStat.isDirectory()) {
                    stack.push(childPath)
                } else {
                    eventStack.push(childPath)
                }
            }
        }

        for (let i = eventStack.length - 1; i >= 0; --i) {
            this.onRemoved(eventStack[i])
        }
    }

    /**
     * Classify the given file change.
     * @param {Map<string, fs.Stats>} files The current files.
     * @param {string} sourcePath The path to a changed file.
     * @param {fs.Stats} currStat The stats object of the changed file.
     * @returns {void}
     * @private
     */
    classifyFileChange(files, sourcePath, currStat) {
        debug("Watcher#classifyFileChange", sourcePath)
        if (this.trigger == null) {
            return
        }

        const prevStat = files.get(sourcePath)
        if (currStat != null) {
            if (prevStat == null) {
                files.set(sourcePath, currStat)

                // Watch recursively if this is a directory.
                if (currStat.isDirectory()) {
                    this.addDirectory(sourcePath)
                } else {
                    this.onAdded(sourcePath)
                }
            } else if (!currStat.isDirectory()) {
                files.set(sourcePath, currStat)
                this.onChanged(sourcePath)
            } else {
                debug("    It's ignored because a directory's change.")
            }
        } else if (prevStat != null) {
            files.delete(sourcePath)

            // Unwatch recursively if this is a directory.
            if (prevStat.isDirectory()) {
                this.removeDirectory(sourcePath)
            } else {
                this.onRemoved(sourcePath)
            }
        } else {
            debug("    No stats. Why?")
        }
    }

    /**
     * Called when this watcher got ready.
     * @returns {void}
     * @private
     */
    onReady() {
        debug("Watcher#onReady")
        this.ready = true
        this.emitReadyEventIfReady()
    }

    /**
     * Called when this watcher detected that a file had been added.
     *
     * If this is ready, enqueue the file to copy the file.
     * Otherwise, copy the file immediately if `initialCopy` option is `true`.
     *
     * @param {string} sourcePath The path to the added file.
     * @returns {void}
     * @private
     */
    onAdded(sourcePath) {
        debug("Watcher#onAdded", sourcePath)
        const normalizedPath = normalizePath(sourcePath)
        if (!this.matcher.match(normalizedPath)) {
            return
        }

        if (this.ready) {
            this.enqueueAdd(normalizedPath)
        } else if (this.initialCopy) {
            this.initialCopyCount += 1
            this.copy(normalizedPath).then(
                this.onDoneInitialCopy,
                this.onDoneInitialCopy
            )
        }
    }

    /**
     * Called when this watcher detected that a file had been removed.
     * @param {string} sourcePath The path to the removed file.
     * @returns {void}
     * @private
     */
    onRemoved(sourcePath) {
        debug("Watcher#onRemoved", sourcePath)
        const normalizedPath = normalizePath(sourcePath)
        if (this.matcher.match(normalizedPath)) {
            this.enqueueRemove(normalizedPath)
        }
    }

    /**
     * Called when this watcher detected that a file had been changed.
     * @param {string} sourcePath The path to the changed file.
     * @returns {void}
     * @private
     */
    onChanged(sourcePath) {
        debug("Watcher#onChanged", sourcePath)
        const normalizedPath = normalizePath(sourcePath)
        if (this.matcher.match(normalizedPath)) {
            this.enqueueChange(normalizedPath)
        }
    }

    /**
     * Called when this watcher threw an error.
     * @param {Error} error The thrown error.
     * @returns {void}
     * @private
     */
    onError(error) {
        debug("Watcher#onError", error)
        this.emit("watch-error", error)
    }

    /**
     * Called by `this.trigger()`.
     * If `this.trigger()` was called multiple times in 0.1 seconds, those are debounced.
     * This execute queued actions (copy or remove).
     * @returns {void}
     * @private
     */
    onTrigger() {
        debug("Watcher#onTrigger")
        co(
            function*() {
                const queue = this.queue

                this.queue = new Map()
                this.pending = true

                // Do copying.
                for (const entry of queue.entries()) {
                    const sourcePath = entry[0]
                    const type = entry[1]

                    if (type === "remove") {
                        try {
                            yield this.remove(sourcePath)
                            this.retries.delete(sourcePath)
                        } catch (error) {
                            if (
                                error.code === "EPERM" &&
                                this.shouldRetry(sourcePath)
                            ) {
                                debug(
                                    "Watcher#onTrigger~retry",
                                    type,
                                    sourcePath
                                )
                                this.onRemoved(sourcePath)
                            } else if (error.code !== "ENOENT") {
                                this.onError(error)
                            }
                        }
                    } else {
                        try {
                            yield this.copy(sourcePath)
                            this.retries.delete(sourcePath)
                        } catch (error) {
                            if (
                                (error.code === "ENOENT" ||
                                    error.code === "EPERM") &&
                                this.shouldRetry(sourcePath)
                            ) {
                                debug(
                                    "Watcher#onTrigger~retry",
                                    type,
                                    sourcePath
                                )
                                if (type === "add") {
                                    this.onAdded(sourcePath)
                                } else {
                                    this.onChanged(sourcePath)
                                }
                            } else {
                                this.onError(error)
                            }
                        }
                    }
                }

                this.pending = false
                if (this.queue.size > 0 && this.trigger != null) {
                    this.trigger()
                }
            }.bind(this)
        )
    }

    /**
     * Check whether the given path should be retried.
     * @param {string} sourcePath The path to the target file.
     * @returns {boolean} `true` if the path should be retried.
     * @private
     */
    shouldRetry(sourcePath) {
        const count = this.retries.get(sourcePath) || 0
        if (count < 10) {
            this.retries.set(sourcePath, 1 + count)
            return true
        }
        this.retries.delete(sourcePath)
        return false
    }

    /**
     * Emit a `watch-ready` event if this is ready and done initial copies.
     * @returns {void}
     * @private
     */
    emitReadyEventIfReady() {
        if (this.ready && this.initialCopyCount === 0) {
            debug("Watcher#ready!")
            this.emit("watch-ready")
        }
    }

    /**
     * Enqueue the given file to copy it.
     * @param {string} sourcePath The path to the target file.
     * @returns {void}
     * @private
     */
    enqueueAdd(sourcePath) {
        debug("Watcher#enqueueAdd", sourcePath)
        const kind = this.queue.get(sourcePath)

        // null -> add
        // add -> add
        // remove -> change
        // change -> change
        this.queue.set(
            sourcePath,
            kind == null || kind === "add" ? "add" : "change"
        )

        if (this.trigger != null && !this.pending) {
            this.trigger()
        }
    }

    /**
     * Enqueue the given file to remove it.
     * @param {string} sourcePath The path to the target file.
     * @returns {void}
     * @private
     */
    enqueueRemove(sourcePath) {
        debug("Watcher#enqueueRemove", sourcePath)
        const kind = this.queue.get(sourcePath)

        // null -> remove
        // add -> null
        // remove -> remove
        // change -> remove
        if (kind === "add") {
            this.queue.delete(sourcePath)
        } else {
            this.queue.set(sourcePath, "remove")
        }

        if (this.trigger != null && !this.pending) {
            this.trigger()
        }
    }

    /**
     * Enqueue the given file to copy it.
     * @param {string} sourcePath The path to the target file.
     * @returns {void}
     * @private
     */
    enqueueChange(sourcePath) {
        debug("Watcher#enqueueChange", sourcePath)
        const kind = this.queue.get(sourcePath)

        // null -> change
        // add -> add
        // remove -> change
        // change -> change
        this.queue.set(sourcePath, kind === "add" ? "add" : "change")

        if (this.trigger != null && !this.pending) {
            this.trigger()
        }
    }

    /**
     * Copy the given file.
     * @param {string} sourcePath The path to the target file.
     * @returns {void}
     * @private
     */
    copy(sourcePath) {
        debug("Watcher#copy", sourcePath)

        return co(
            function*() {
                const outputPath = this.toDestination(sourcePath)
                if (outputPath !== sourcePath) {
                    yield copyFile(sourcePath, outputPath, this)
                    debug("Watcher#copy~done", sourcePath)
                    this.emit("copy", {
                        srcPath: sourcePath,
                        dstPath: outputPath,
                    })
                }
            }.bind(this)
        )
    }

    /**
     * Remove the given file.
     * @param {string} sourcePath The path to the target file.
     * @returns {void}
     * @private
     */
    remove(sourcePath) {
        debug("Watcher#remove", sourcePath)

        return co(
            function*() {
                const outputPath = this.toDestination(sourcePath)
                if (outputPath !== sourcePath) {
                    yield removeFile(outputPath)
                    debug("Watcher#remove~done", sourcePath)
                    this.emit("remove", { path: outputPath })
                }
            }.bind(this)
        )
    }

    /**
     * @inheritdoc
     * Emit on the next tick.
     */
    emit(type, ...args) {
        process.nextTick(() => {
            debug("emit", type)
            super.emit(type, ...args)
        })
    }
}
