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
const chokidar = require("chokidar")
const co = require("co")
const debounce = require("debounce")
const Minimatch = require("minimatch").Minimatch
const copyFile = require("./copy-file")
const normalizePath = require("./normalize-path")
const removeFile = require("./remove-file")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

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

        this.baseDir = options.baseDir
        this.dereference = options.dereference
        this.includeEmptyDirs = options.includeEmptyDirs
        this.initialCopy = options.initialCopy
        this.initialCopyCount = 0
        this.matcher = new Minimatch(options.source)
        this.onDoneInitialCopy = () => {
            this.initialCopyCount -= 1
            this.emitReadyEventIfReady()
        }
        this.outputDir = options.outputDir
        this.preserve = options.preserve
        this.pending = false
        this.queue = new Map()
        this.ready = false
        this.source = options.source
        this.toDestination = options.toDestination
        this.trigger = null
        this.transform = options.transform
        this.update = options.update
        this.watcher = null
    }

    /**
     * Open this watcher.
     * @returns {void}
     */
    open() {
        this.close()

        const watchOptions = {
            disableGlobbing: true,
            followSymlinks: this.dereference,
            persistent: true,
        }
        const onReady = this.onReady.bind(this)
        const onAdded = this.onAdded.bind(this)
        const onRemoved = this.onRemoved.bind(this)
        const onChange = this.onChange.bind(this)
        const onError = this.onError.bind(this)
        const onTrigger = this.onTrigger.bind(this)

        this.trigger = debounce(onTrigger, 100)
        this.watcher = chokidar
            .watch(this.baseDir, watchOptions)
            .on("ready", onReady)
            .on("add", onAdded)
            .on("unlink", onRemoved)
            .on("unlinkDir", onRemoved)
            .on("change", onChange)
            .on("error", onError)

        if (this.includeEmptyDirs) {
            this.watcher.on("addDir", onAdded)
        }
    }

    /**
     * Close this watcher.
     * @returns {void}
     */
    close() {
        if (this.trigger != null) {
            this.trigger.clear()
            this.trigger = null
        }
        if (this.watcher != null) {
            this.watcher.close()
            this.watcher = null
        }
    }

    /**
     * Called when this watcher got ready.
     * @returns {void}
     * @private
     */
    onReady() {
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
        const normalizedPath = normalizePath(sourcePath)
        if (!this.matcher.match(normalizedPath)) {
            return
        }

        if (this.ready) {
            this.enqueueAdd(normalizedPath)
        }
        else if (this.initialCopy) {
            this.initialCopyCount += 1
            this.copy(normalizedPath)
                .then(this.onDoneInitialCopy, this.onDoneInitialCopy)
        }
    }

    /**
     * Called when this watcher detected that a file had been removed.
     * @param {string} sourcePath The path to the removed file.
     * @returns {void}
     * @private
     */
    onRemoved(sourcePath) {
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
    onChange(sourcePath) {
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
        co(function* () {
            while (this.queue.size !== 0) {
                const queue = this.queue

                this.queue = new Map()
                this.pending = true

                // Do copying.
                for (const entry of queue.entries()) {
                    const sourcePath = entry[0]
                    const type = entry[1]

                    try {
                        if (type === "remove") {
                            yield this.remove(sourcePath)
                        }
                        else {
                            yield this.copy(sourcePath)
                        }
                    }
                    catch (error) {
                        this.onError(error)
                    }
                }

                this.pending = false
            }
        }.bind(this))
    }

    /**
     * Emit a `watch-ready` event if this is ready and done initial copies.
     * @returns {void}
     * @private
     */
    emitReadyEventIfReady() {
        if (this.ready && this.initialCopyCount === 0) {
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
        const kind = this.queue.get(sourcePath)

        // null -> add
        // add -> add
        // remove -> change
        // change -> change
        this.queue.set(
            sourcePath,
            (kind == null || kind === "add") ? "add" : "change"
        )

        if (!this.pending) {
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
        const kind = this.queue.get(sourcePath)

        // null -> remove
        // add -> null
        // remove -> remove
        // change -> remove
        if (kind === "add") {
            this.queue.delete(sourcePath)
        }
        else {
            this.queue.set(sourcePath, "remove")
        }

        if (!this.pending) {
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
        const kind = this.queue.get(sourcePath)

        // null -> change
        // add -> add
        // remove -> change
        // change -> change
        this.queue.set(
            sourcePath,
            (kind === "add") ? "add" : "change"
        )

        if (!this.pending) {
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
        return co(function* () {
            const outputPath = this.toDestination(sourcePath)
            if (outputPath !== sourcePath) {
                yield copyFile(sourcePath, outputPath, this)
                this.emit("copy", {srcPath: sourcePath, dstPath: outputPath})
            }
        }.bind(this))
    }

    /**
     * Remove the given file.
     * @param {string} sourcePath The path to the target file.
     * @returns {void}
     * @private
     */
    remove(sourcePath) {
        return co(function* () {
            const outputPath = this.toDestination(sourcePath)
            if (outputPath !== sourcePath) {
                yield removeFile(outputPath)
                this.emit("remove", {path: outputPath})
            }
        }.bind(this))
    }
}
