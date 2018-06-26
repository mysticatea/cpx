/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const assert = require("assert")
const path = require("path")
const co = require("co")
const fs = require("fs-extra")
const pEvent = require("p-event")
const ensureDir = fs.ensureDir
const remove = fs.remove
const cpx = require("..")
const util = require("./util/util")
const delay = util.delay
const setupTestDir = util.setupTestDir
const teardownTestDir = util.teardownTestDir
const verifyTestDir = util.verifyTestDir
const writeFile = util.writeFile
const removeFile = util.removeFile
const execCommand = util.execCommand

//------------------------------------------------------------------------------
// Test
//------------------------------------------------------------------------------

describe("The watch method", () => {
    let watcher = null
    let command = null

    afterEach(co.wrap(function* () {
        if (watcher) {
            watcher.close()
            watcher = null
        }
        if (command) {
            command.stdin.write("KILL")
            yield pEvent(command, "exit")
            yield teardownTestDir("test-ws")
            command = null
        }
        else {
            yield teardownTestDir("test-ws")
        }
    }))

    /**
     * Wait for ready.
     * @returns {Promise<void>} The promise which will go fulfilled after done.
     */
    const waitForReady = co.wrap(function* () {
        if (watcher) {
            yield pEvent(watcher, "watch-ready")
        }
        else if (command) {
            while (true) {
                const chunk = yield pEvent(command.stdout, "data")
                if (chunk.indexOf("Be watching") >= 0) {
                    break
                }
            }
        }
        yield delay(250)
    })

    /**
     * Wait for a copy.
     * @returns {Promise<void>} The promise which will go fulfilled after done.
     */
    const waitForCopy = co.wrap(function* () {
        if (watcher) {
            yield pEvent(watcher, "copy")
        }
        else if (command) {
            while (true) {
                const chunk = yield pEvent(command.stdout, "data")
                if (chunk.indexOf("Copied:") >= 0) {
                    break
                }
            }
        }
        yield delay(250)
    })

    /**
     * Wait for a remove.
     * @returns {Promise<void>} The promise which will go fulfilled after done.
     */
    const waitForRemove = co.wrap(function* () {
        if (watcher) {
            yield pEvent(watcher, "remove")
        }
        else if (command) {
            while (true) {
                const chunk = yield pEvent(command.stdout, "data")
                if (chunk.indexOf("Removed:") >= 0) {
                    break
                }
            }
        }
        yield delay(250)
    })

    //==========================================================================

    describe("should copy specified files with globs at first:", () => {
        beforeEach(() => setupTestDir({
            "test-ws/untouchable.txt": "untouchable",
            "test-ws/a/hello.txt": "Hello",
            "test-ws/a/b/this-is.txt": "A pen",
            "test-ws/a/b/that-is.txt": "A note",
            "test-ws/a/b/no-copy.dat": "no-copy",
        }))

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            return verifyTestDir({
                "test-ws/untouchable.txt": "untouchable",
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/this-is.txt": "A pen",
                "test-ws/a/b/that-is.txt": "A note",
                "test-ws/a/b/no-copy.dat": "no-copy",
                "test-ws/b/untouchable.txt": null,
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/b/this-is.txt": "A pen",
                "test-ws/b/b/that-is.txt": "A note",
                "test-ws/b/b/no-copy.dat": null,
            })
        }

        it("lib version.", co.wrap(function* () {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b")
            yield waitForReady()
            yield verifyFiles()
        }))

        it("command version.", co.wrap(function* () {
            command = execCommand("\"test-ws/a/**/*.txt\" test-ws/b --watch --verbose")
            yield waitForReady()
            yield verifyFiles()
        }))
    })

    describe("should copy files in symlink directory at first when `--dereference` option was given:", () => {
        beforeEach(co.wrap(function* () {
            yield setupTestDir({
                "test-ws/src/a/hello.txt": "Symlinked",
                "test-ws/a/hello.txt": "Hello",
            })
            yield fs.symlink(
                path.resolve("test-ws/src"),
                path.resolve("test-ws/a/link"),
                "junction"
            )
        }))

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            return verifyTestDir({
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/link/a/hello.txt": "Symlinked",
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/link/a/hello.txt": "Symlinked",
            })
        }

        it("lib version.", co.wrap(function* () {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b", { dereference: true })
            yield waitForReady()
            yield verifyFiles()
        }))

        it("command version.", co.wrap(function* () {
            command = execCommand("\"test-ws/a/**/*.txt\" test-ws/b --watch --dereference --verbose")
            yield waitForReady()
            yield verifyFiles()
        }))
    })

    describe("should not copy files in symlink directory when `--dereference` option was not given:", () => {
        beforeEach(co.wrap(function* () {
            yield setupTestDir({
                "test-ws/src/a/hello.txt": "Symlinked",
                "test-ws/a/hello.txt": "Hello",
            })
            yield fs.symlink(
                path.resolve("test-ws/src"),
                path.resolve("test-ws/a/link"),
                "junction"
            )
        }))

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            return verifyTestDir({
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/link/a/hello.txt": "Symlinked",
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/link/a/hello.txt": null,
            })
        }

        it("lib version.", co.wrap(function* () {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b", { dereference: false })
            yield waitForReady()
            yield verifyFiles()
        }))

        it("command version.", co.wrap(function* () {
            command = execCommand("\"test-ws/a/**/*.txt\" test-ws/b --watch --verbose")
            yield waitForReady()
            yield verifyFiles()
        }))
    })

    describe("should copy specified files with globs at first even if the glob starts with `./`:", () => {
        beforeEach(() => setupTestDir({
            "test-ws/untouchable.txt": "untouchable",
            "test-ws/a/hello.txt": "Hello",
            "test-ws/a/b/this-is.txt": "A pen",
            "test-ws/a/b/that-is.txt": "A note",
            "test-ws/a/b/no-copy.dat": "no-copy",
        }))

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            return verifyTestDir({
                "test-ws/untouchable.txt": "untouchable",
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/this-is.txt": "A pen",
                "test-ws/a/b/that-is.txt": "A note",
                "test-ws/a/b/no-copy.dat": "no-copy",
                "test-ws/b/untouchable.txt": null,
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/b/this-is.txt": "A pen",
                "test-ws/b/b/that-is.txt": "A note",
                "test-ws/b/b/no-copy.dat": null,
            })
        }

        it("lib version.", co.wrap(function* () {
            watcher = cpx.watch("./test-ws/a/**/*.txt", "test-ws/b")
            yield waitForReady()
            yield verifyFiles()
        }))

        it("command version.", co.wrap(function* () {
            command = execCommand("\"./test-ws/a/**/*.txt\" test-ws/b --watch --verbose")
            yield waitForReady()
            yield verifyFiles()
        }))
    })

    describe("should clean and copy specified file blobs at first when give clean option:", () => {
        beforeEach(() => setupTestDir({
            "test-ws/untouchable.txt": "untouchable",
            "test-ws/a/hello.txt": "Hello",
            "test-ws/a/b/this-is.txt": "A pen",
            "test-ws/a/b/that-is.txt": "A note",
            "test-ws/a/b/no-copy.dat": "no-copy",
            "test-ws/b/b/remove.txt": "remove",
            "test-ws/b/b/no-remove.dat": "no-remove",
        }))

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            return verifyTestDir({
                "test-ws/untouchable.txt": "untouchable",
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/this-is.txt": "A pen",
                "test-ws/a/b/that-is.txt": "A note",
                "test-ws/a/b/no-copy.dat": "no-copy",
                "test-ws/b/untouchable.txt": null,
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/b/this-is.txt": "A pen",
                "test-ws/b/b/that-is.txt": "A note",
                "test-ws/b/b/no-copy.dat": null,
                "test-ws/b/b/remove.txt": null,
                "test-ws/b/b/no-remove.dat": "no-remove",
            })
        }

        it("lib version.", co.wrap(function* () {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b", { clean: true })
            yield waitForReady()
            yield verifyFiles()
        }))

        it("command version.", co.wrap(function* () {
            command = execCommand("\"test-ws/a/**/*.txt\" test-ws/b --clean --watch --verbose")
            yield waitForReady()
            yield verifyFiles()
        }))
    })

    describe("should not copy specified files with globs at first when `--no-initial` option was given:", () => {
        beforeEach(() => setupTestDir({
            "test-ws/untouchable.txt": "untouchable",
            "test-ws/a/hello.txt": "Hello",
            "test-ws/a/b/this-is.txt": "A pen",
            "test-ws/a/b/that-is.txt": "A note",
            "test-ws/a/b/no-copy.dat": "no-copy",
        }))

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            return verifyTestDir({
                "test-ws/untouchable.txt": "untouchable",
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/this-is.txt": "A pen",
                "test-ws/a/b/that-is.txt": "A note",
                "test-ws/a/b/no-copy.dat": "no-copy",
                "test-ws/b/untouchable.txt": null,
                "test-ws/b/hello.txt": null,
                "test-ws/b/b/this-is.txt": null,
                "test-ws/b/b/that-is.txt": null,
                "test-ws/b/b/no-copy.dat": null,
            })
        }

        it("lib version.", co.wrap(function* () {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b", { initialCopy: false })
            yield waitForReady()
            yield verifyFiles()
        }))

        it("command version.", co.wrap(function* () {
            command = execCommand("\"test-ws/a/**/*.txt\" test-ws/b --no-initial --watch --verbose")
            yield waitForReady()
            yield verifyFiles()
        }))
    })

    const patterns = [
        {
            description: "should copy on file added:",
            initialFiles: { "test-ws/a/hello.txt": "Hello" },
            action() {
                return writeFile("test-ws/a/b/added.txt", "added")
            },
            verify: {
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/b/added.txt": "added",
            },
            wait: waitForCopy,
        },
        {
            description: "should do nothing on file added if unmatch file globs:",
            initialFiles: { "test-ws/a/hello.txt": "Hello" },
            action() {
                return co(function* () {
                    yield writeFile("test-ws/a/b/not-added.dat", "added")
                    yield writeFile("test-ws/a/a.txt", "a")
                })
            },
            verify: {
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/b/not-added.dat": null,
            },
            wait: waitForCopy,
        },
        {
            description: "should copy on file changed:",
            initialFiles: { "test-ws/a/hello.txt": "Hello" },
            action() {
                return writeFile("test-ws/a/hello.txt", "changed")
            },
            verify: { "test-ws/b/hello.txt": "changed" },
            wait: waitForCopy,
        },
        {
            description: "should do nothing on file changed if unmatch file globs:",
            initialFiles: {
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/hello.dat": "Hello",
            },
            action() {
                return co(function* () {
                    yield writeFile("test-ws/a/hello.dat", "changed")
                    yield writeFile("test-ws/a/a.txt", "a")
                })
            },
            verify: {
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/hello.dat": null,
            },
            wait: waitForCopy,
        },
        {
            description: "should remove in the destination directory on file removed:",
            initialFiles: { "test-ws/a/hello.txt": "Hello" },
            action() {
                return removeFile("test-ws/a/hello.txt")
            },
            verify: { "test-ws/b/hello.txt": null },
            wait: waitForRemove,
        },
        {
            description: "should do nothing on file removed if unmatch file globs:",
            initialFiles: {
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/hello.dat": "Hello",
            },
            action() {
                return co(function* () {
                    yield removeFile("test-ws/a/hello.dat")
                    yield writeFile("test-ws/a/hello.txt", "changed")
                })
            },
            verify: {
                "test-ws/b/hello.txt": "changed",
                "test-ws/b/hello.dat": null,
            },
            wait: waitForCopy,
        },
    ]
    for (const pattern of patterns) {
        (pattern.only ? describe.only : describe)(pattern.description, () => { //eslint-disable-line no-loop-func
            beforeEach(() => setupTestDir(pattern.initialFiles))

            it("lib version.", co.wrap(function* () {
                watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b")
                yield waitForReady()
                yield pattern.action()
                yield pattern.wait()
                yield verifyTestDir(pattern.verify)
            }))

            it("command version.", co.wrap(function* () {
                command = execCommand("\"test-ws/a/**/*.txt\" test-ws/b --watch --verbose")
                yield waitForReady()
                yield pattern.action()
                yield pattern.wait()
                yield verifyTestDir(pattern.verify)
            }))
        })
    }

    describe("should do reactions of multiple events:", () => {
        beforeEach(() => setupTestDir({
            "test-ws/a/hello.txt": "Hello",
            "test-ws/a/hello.dat": "Hello",
        }))

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            return verifyTestDir({
                "test-ws/b/hello.txt": null,
                "test-ws/b/hello.dat": null,
                "test-ws/b/added.txt": "added",
                "test-ws/b/added.dat": null,
            })
        }

        it("lib version.", co.wrap(function* () {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b")
            yield waitForReady()
            yield removeFile("test-ws/a/hello.dat")
            yield removeFile("test-ws/a/hello.txt")
            yield writeFile("test-ws/a/added.dat", "added_data")
            yield writeFile("test-ws/a/added.txt", "added")
            yield waitForCopy()
            yield verifyFiles()
        }))

        it("command version.", co.wrap(function* () {
            command = execCommand("\"test-ws/a/**/*.txt\" test-ws/b --watch --verbose")
            yield waitForReady()
            yield removeFile("test-ws/a/hello.dat")
            yield removeFile("test-ws/a/hello.txt")
            yield writeFile("test-ws/a/added.dat", "added_data")
            yield writeFile("test-ws/a/added.txt", "added")
            yield waitForCopy()
            yield verifyFiles()
        }))
    })

    describe("should copy it when an empty directory is added when '--include-empty-dirs' option was given:", () => {
        beforeEach(() => setupTestDir({
            "test-ws/a/hello.txt": "Hello",
            "test-ws/a/b/hello.txt": "Hello",
        }))

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(fs.statSync("test-ws/b/c").isDirectory())
            return verifyTestDir({
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/b/hello.txt": "Hello",
            })
        }

        it("lib version.", co.wrap(function* () {
            watcher = cpx.watch("test-ws/a/**", "test-ws/b", { includeEmptyDirs: true })
            yield waitForReady()
            yield ensureDir("test-ws/a/c")
            yield waitForCopy()
            yield verifyFiles()
        }))

        it("command version.", co.wrap(function* () {
            command = execCommand("\"test-ws/a/**\" test-ws/b --include-empty-dirs --watch --verbose")
            yield waitForReady()
            yield ensureDir("test-ws/a/c")
            yield waitForCopy()
            yield verifyFiles()
        }))
    })

    describe("should remove it on destination when an empty directory is removed when '--include-empty-dirs' option was given:", () => {
        beforeEach(() => setupTestDir({
            "test-ws/a/hello.txt": "Hello",
            "test-ws/a/b/hello.txt": "Hello",
            "test-ws/a/c": null,
        }))

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert.throws(() => fs.statSync("test-ws/b/c"), /ENOENT/)
            return verifyTestDir({
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/b/hello.txt": "Hello",
            })
        }

        it("lib version.", co.wrap(function* () {
            watcher = cpx.watch("test-ws/a/**", "test-ws/b", { includeEmptyDirs: true })
            yield waitForReady()
            yield remove("test-ws/a/c")
            yield waitForRemove()
            yield verifyFiles()
        }))

        it("command version.", co.wrap(function* () {
            command = execCommand("\"test-ws/a/**\" test-ws/b --include-empty-dirs --watch --verbose")
            yield waitForReady()
            yield remove("test-ws/a/c")
            yield waitForRemove()
            yield verifyFiles()
        }))
    })

    describe("should copy it when a file is added even if '--no-initial' option was given:", () => {
        beforeEach(() => setupTestDir({
            "test-ws/a/hello.txt": "Hello",
            "test-ws/a/b/hello.txt": "Hello",
        }))

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            return verifyTestDir({
                "test-ws/b/hello.txt": null,
                "test-ws/b/b/hello.txt": null,
                "test-ws/b/added.txt": "added",
            })
        }

        it("lib version.", co.wrap(function* () {
            watcher = cpx.watch("test-ws/a/**", "test-ws/b", { initialCopy: false })
            yield waitForReady()
            yield writeFile("test-ws/a/added.txt", "added")
            yield waitForCopy()
            yield verifyFiles()
        }))

        it("command version.", co.wrap(function* () {
            command = execCommand("\"test-ws/a/**\" test-ws/b --no-initial --watch --verbose")
            yield waitForReady()
            yield writeFile("test-ws/a/added.txt", "added")
            yield waitForCopy()
            yield verifyFiles()
        }))
    })

    describe("should copy it when a file is modified even if there are parentheses in path:", () => {
        beforeEach(() => setupTestDir({ //
            "test-ws/a(paren)/hello.txt": "Hello",
        }))

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            return verifyTestDir({
                "test-ws/a(paren)/hello.txt": "Hello 2",
                "test-ws/b/hello.txt": "Hello 2",
            })
        }

        it("lib version.", co.wrap(function* () {
            watcher = cpx.watch("test-ws/a(paren)/**", "test-ws/b", { initialCopy: false })
            yield waitForReady()
            yield writeFile("test-ws/a(paren)/hello.txt", "Hello 2")
            yield waitForCopy()
            yield verifyFiles()
        }))

        it("command version.", co.wrap(function* () {
            command = execCommand("\"test-ws/a(paren)/**\" test-ws/b --no-initial --watch --verbose")
            yield waitForReady()
            yield writeFile("test-ws/a(paren)/hello.txt", "Hello 2")
            yield waitForCopy()
            yield verifyFiles()
        }))
    })
})
