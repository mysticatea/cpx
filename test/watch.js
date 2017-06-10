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
const fs = require("fs-extra")
const ensureDirSync = fs.ensureDirSync
const removeSync = fs.removeSync
const cpx = require("..")
const util = require("./util/util")
const setupTestDir = util.setupTestDir
const teardownTestDir = util.teardownTestDir
const content = util.content
const writeFile = util.writeFile
const removeFile = util.removeFile
const execCommand = util.execCommand

//------------------------------------------------------------------------------
// Test
//------------------------------------------------------------------------------

describe("The watch method", () => {
    let watcher = null
    let command = null

    afterEach(done => {
        if (watcher) {
            watcher.close()
            watcher = null
        }
        if (command) {
            command.stdin.write("KILL")
            command.on("exit", () => {
                teardownTestDir("test-ws")
                done()
            })
            command = null
        }
        else {
            teardownTestDir("test-ws")
            done()
        }
    })

    /**
     * Wait for ready.
     * @param {function} cb - A callback function.
     * @returns {void}
     */
    function waitForReady(cb) {
        if (watcher) {
            watcher.on("watch-ready", function listener() {
                watcher.removeListener("watch-ready", listener)
                cb()
            })
        }
        else if (command) {
            command.stdout.on("data", function listener(chunk) {
                // Done the first copies.
                if (chunk.indexOf("Be watching") >= 0) {
                    command.stdout.removeListener("data", listener)
                    cb()
                }
            })
        }
        else {
            cb()
        }
    }

    /**
     * Wait for a copy.
     * @param {function} cb - A callback function.
     * @returns {void}
     */
    function waitForCopy(cb) {
        if (watcher) {
            watcher.on("copy", function listener() {
                watcher.removeListener("copy", listener)
                cb()
            })
        }
        else if (command) {
            command.stdout.on("data", function listener(chunk) {
                // Done the first copies.
                if (chunk.indexOf("Copied: ") >= 0) {
                    command.stdout.removeListener("data", listener)
                    cb()
                }
            })
        }
        else {
            cb()
        }
    }

    /**
     * Wait for a remove.
     * @param {function} cb - A callback function.
     * @returns {void}
     */
    function waitForRemove(cb) {
        if (watcher) {
            watcher.on("remove", function listener() {
                watcher.removeListener("remove", listener)
                cb()
            })
        }
        else if (command) {
            command.stdout.on("data", function listener(chunk) {
                // Done the first copies.
                if (chunk.indexOf("Removed: ") >= 0) {
                    command.stdout.removeListener("data", listener)
                    cb()
                }
            })
        }
        else {
            cb()
        }
    }

    //==========================================================================

    describe("should copy specified files with globs at first:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/untouchable.txt": "untouchable",
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/this-is.txt": "A pen",
                "test-ws/a/b/that-is.txt": "A note",
                "test-ws/a/b/no-copy.dat": "no-copy",
            })
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/untouchable.txt") === "untouchable")
            assert(content("test-ws/a/hello.txt") === "Hello")
            assert(content("test-ws/a/b/this-is.txt") === "A pen")
            assert(content("test-ws/a/b/that-is.txt") === "A note")
            assert(content("test-ws/a/b/no-copy.dat") === "no-copy")
            assert(content("test-ws/b/untouchable.txt") === null)
            assert(content("test-ws/b/hello.txt") === "Hello")
            assert(content("test-ws/b/b/this-is.txt") === "A pen")
            assert(content("test-ws/b/b/that-is.txt") === "A note")
            assert(content("test-ws/b/b/no-copy.dat") === null)
        }

        it("lib version.", (done) => {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b")
            watcher.on("watch-ready", () => {
                // Done the first copies.
                verifyFiles()
                done()
            })
        })

        it("command version.", (done) => {
            command = execCommand("\"test-ws/a/**/*.txt\" test-ws/b --watch --verbose")
            waitForReady(() => {
                verifyFiles()
                done()
            })
        })
    })

    describe("should copy files in symlink directory at first when `--dereference` option was given:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/src/a/hello.txt": "Symlinked",
                "test-ws/a/hello.txt": "Hello",
            })
            fs.symlinkSync(
                path.resolve("test-ws/src"),
                path.resolve("test-ws/a/link"),
                "junction"
            )
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/a/hello.txt") === "Hello")
            assert(content("test-ws/a/link/a/hello.txt") === "Symlinked")
            assert(content("test-ws/b/hello.txt") === "Hello")
            assert(content("test-ws/b/link/a/hello.txt") === "Symlinked")
        }

        it("lib version.", (done) => {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b", {dereference: true})
            watcher.on("watch-ready", () => {
                // Done the first copies.
                verifyFiles()
                done()
            })
        })

        it("command version.", (done) => {
            command = execCommand("\"test-ws/a/**/*.txt\" test-ws/b --watch --dereference --verbose")
            waitForReady(() => {
                verifyFiles()
                done()
            })
        })
    })

    describe("should not copy files in symlink directory when `--dereference` option was not given:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/src/a/hello.txt": "Symlinked",
                "test-ws/a/hello.txt": "Hello",
            })
            fs.symlinkSync(
                path.resolve("test-ws/src"),
                path.resolve("test-ws/a/link"),
                "junction"
            )
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/a/hello.txt") === "Hello")
            assert(content("test-ws/a/link/a/hello.txt") === "Symlinked")
            assert(content("test-ws/b/hello.txt") === "Hello")
            assert(content("test-ws/b/link/a/hello.txt") === null)
        }

        it("lib version.", (done) => {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b", {dereference: false})
            watcher.on("watch-ready", () => {
                // Done the first copies.
                verifyFiles()
                done()
            })
        })

        it("command version.", (done) => {
            command = execCommand("\"test-ws/a/**/*.txt\" test-ws/b --watch --verbose")
            waitForReady(() => {
                verifyFiles()
                done()
            })
        })
    })

    describe("should copy specified files with globs at first even if the glob starts with `./`:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/untouchable.txt": "untouchable",
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/this-is.txt": "A pen",
                "test-ws/a/b/that-is.txt": "A note",
                "test-ws/a/b/no-copy.dat": "no-copy",
            })
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/untouchable.txt") === "untouchable")
            assert(content("test-ws/a/hello.txt") === "Hello")
            assert(content("test-ws/a/b/this-is.txt") === "A pen")
            assert(content("test-ws/a/b/that-is.txt") === "A note")
            assert(content("test-ws/a/b/no-copy.dat") === "no-copy")
            assert(content("test-ws/b/untouchable.txt") === null)
            assert(content("test-ws/b/hello.txt") === "Hello")
            assert(content("test-ws/b/b/this-is.txt") === "A pen")
            assert(content("test-ws/b/b/that-is.txt") === "A note")
            assert(content("test-ws/b/b/no-copy.dat") === null)
        }

        it("lib version.", (done) => {
            watcher = cpx.watch("./test-ws/a/**/*.txt", "test-ws/b")
            watcher.on("watch-ready", () => {
                // Done the first copies.
                verifyFiles()
                done()
            })
        })

        it("command version.", (done) => {
            command = execCommand("\"./test-ws/a/**/*.txt\" test-ws/b --watch --verbose")
            waitForReady(() => {
                verifyFiles()
                done()
            })
        })
    })

    describe("should clean and copy specified file blobs at first when give clean option:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/untouchable.txt": "untouchable",
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/this-is.txt": "A pen",
                "test-ws/a/b/that-is.txt": "A note",
                "test-ws/a/b/no-copy.dat": "no-copy",
                "test-ws/b/b/remove.txt": "remove",
                "test-ws/b/b/no-remove.dat": "no-remove",
            })
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/untouchable.txt") === "untouchable")
            assert(content("test-ws/a/hello.txt") === "Hello")
            assert(content("test-ws/a/b/this-is.txt") === "A pen")
            assert(content("test-ws/a/b/that-is.txt") === "A note")
            assert(content("test-ws/a/b/no-copy.dat") === "no-copy")
            assert(content("test-ws/b/untouchable.txt") === null)
            assert(content("test-ws/b/hello.txt") === "Hello")
            assert(content("test-ws/b/b/this-is.txt") === "A pen")
            assert(content("test-ws/b/b/that-is.txt") === "A note")
            assert(content("test-ws/b/b/no-copy.dat") === null)
            assert(content("test-ws/b/b/remove.txt") === null)
            assert(content("test-ws/b/b/no-remove.dat") === "no-remove")
        }

        it("lib version.", (done) => {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b", {clean: true})
            waitForReady(() => {
                // Done the first copies.
                verifyFiles()
                done()
            })
        })

        it("command version.", (done) => {
            command = execCommand("\"test-ws/a/**/*.txt\" test-ws/b --clean --watch --verbose")
            waitForReady(() => {
                verifyFiles()
                done()
            })
        })
    })

    describe("should not copy specified files with globs at first when `--no-initial` option was given:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/untouchable.txt": "untouchable",
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/this-is.txt": "A pen",
                "test-ws/a/b/that-is.txt": "A note",
                "test-ws/a/b/no-copy.dat": "no-copy",
            })
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/untouchable.txt") === "untouchable")
            assert(content("test-ws/a/hello.txt") === "Hello")
            assert(content("test-ws/a/b/this-is.txt") === "A pen")
            assert(content("test-ws/a/b/that-is.txt") === "A note")
            assert(content("test-ws/a/b/no-copy.dat") === "no-copy")
            assert(content("test-ws/b/untouchable.txt") === null)
            assert(content("test-ws/b/hello.txt") === null)
            assert(content("test-ws/b/b/this-is.txt") === null)
            assert(content("test-ws/b/b/that-is.txt") === null)
            assert(content("test-ws/b/b/no-copy.dat") === null)
        }

        it("lib version.", (done) => {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b", {initialCopy: false})
            watcher.on("watch-ready", () => {
                // Done the first copies.
                verifyFiles()
                done()
            })
        })

        it("command version.", (done) => {
            command = execCommand("\"test-ws/a/**/*.txt\" test-ws/b --no-initial --watch --verbose")
            waitForReady(() => {
                verifyFiles()
                done()
            })
        })
    })

    const patterns = [
        {
            description: "should copy on file added:",
            initialFiles: {"test-ws/a/hello.txt": "Hello"},
            action() {
                writeFile("test-ws/a/b/added.txt", "added")
            },
            verify: {
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/b/added.txt": "added",
            },
            wait: waitForCopy,
        },
        {
            description: "should do nothing on file added if unmatch file globs:",
            initialFiles: {"test-ws/a/hello.txt": "Hello"},
            action() {
                writeFile("test-ws/a/b/not-added.dat", "added")
                // To fire copy event.
                writeFile("test-ws/a/a.txt", "a")
            },
            verify: {
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/b/not-added.dat": null,
            },
            wait: waitForCopy,
        },
        {
            description: "should copy on file changed:",
            initialFiles: {"test-ws/a/hello.txt": "Hello"},
            action() {
                writeFile("test-ws/a/hello.txt", "changed")
            },
            verify: {"test-ws/b/hello.txt": "changed"},
            wait: waitForCopy,
        },
        {
            description: "should do nothing on file changed if unmatch file globs:",
            initialFiles: {
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/hello.dat": "Hello",
            },
            action() {
                writeFile("test-ws/a/hello.dat", "changed")
                // To fire copy event.
                writeFile("test-ws/a/a.txt", "a")
            },
            verify: {
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/hello.dat": null,
            },
            wait: waitForCopy,
        },
        {
            description: "should remove in the destination directory on file removed:",
            initialFiles: {"test-ws/a/hello.txt": "Hello"},
            action() {
                removeFile("test-ws/a/hello.txt")
            },
            verify: {"test-ws/b/hello.txt": null},
            wait: waitForRemove,
        },
        {
            description: "should do nothing on file removed if unmatch file globs:",
            initialFiles: {
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/hello.dat": "Hello",
            },
            action() {
                removeFile("test-ws/a/hello.dat")
                // To fire copy event.
                writeFile("test-ws/a/hello.txt", "changed")
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
            beforeEach(() => {
                setupTestDir(pattern.initialFiles)
            })

            /**
             * Verify.
             * @returns {void}
             */
            function verifyFiles() {
                for (const file of Object.keys(pattern.verify)) {
                    assert(content(file) === pattern.verify[file])
                }
            }

            it("lib version.", (done) => {
                watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b")
                waitForReady(() => {
                    pattern.action()
                    pattern.wait(() => {
                        verifyFiles()
                        done()
                    })
                })
            })

            it("command version.", (done) => {
                command = execCommand("\"test-ws/a/**/*.txt\" test-ws/b --watch --verbose")
                waitForReady(() => {
                    pattern.action()
                    pattern.wait(() => {
                        verifyFiles()
                        done()
                    })
                })
            })
        })
    }

    describe("should do reactions of multiple events:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/hello.dat": "Hello",
            })
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            const files = {
                "test-ws/b/hello.txt": null,
                "test-ws/b/hello.dat": null,
                "test-ws/b/added.txt": "added",
                "test-ws/b/added.dat": null,
            }
            for (const file of Object.keys(files)) {
                assert(content(file) === files[file])
            }
        }

        xit("lib version.", (done) => {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b")
            waitForReady(() => {
                removeFile("test-ws/a/hello.dat")
                removeFile("test-ws/a/hello.txt")
                writeFile("test-ws/a/added.dat", "added_data")
                writeFile("test-ws/a/added.txt", "added")
                waitForRemove(() => {
                    verifyFiles()
                    done()
                })
            })
        })

        it("command version.", (done) => {
            command = execCommand("\"test-ws/a/**/*.txt\" test-ws/b --watch --verbose")
            waitForReady(() => {
                removeFile("test-ws/a/hello.dat")
                removeFile("test-ws/a/hello.txt")
                writeFile("test-ws/a/added.dat", "added_data")
                writeFile("test-ws/a/added.txt", "added")
                waitForRemove(() => {
                    verifyFiles()
                    done()
                })
            })
        })
    })

    describe("should copy it when an empty directory is added when '--include-empty-dirs' option was given:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/hello.txt": "Hello",
            })
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/b/hello.txt") === "Hello")
            assert(content("test-ws/b/b/hello.txt") === "Hello")
            assert(fs.statSync("test-ws/b/c").isDirectory())
        }

        it("lib version.", (done) => {
            watcher = cpx.watch("test-ws/a/**", "test-ws/b", {includeEmptyDirs: true})
            waitForReady(() => {
                ensureDirSync("test-ws/a/c")
                waitForCopy(() => {
                    verifyFiles()
                    done()
                })
            })
        })

        it("command version.", (done) => {
            command = execCommand("\"test-ws/a/**\" test-ws/b --include-empty-dirs --watch --verbose")
            waitForReady(() => {
                ensureDirSync("test-ws/a/c")
                waitForCopy(() => {
                    verifyFiles()
                    done()
                })
            })
        })
    })

    describe("should remove it on destination when an empty directory is removed when '--include-empty-dirs' option was given:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/hello.txt": "Hello",
                "test-ws/a/c": null,
            })
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/b/hello.txt") === "Hello")
            assert(content("test-ws/b/b/hello.txt") === "Hello")
            assert.throws(() => fs.statSync("test-ws/b/c"), /ENOENT/)
        }

        it("lib version.", (done) => {
            watcher = cpx.watch("test-ws/a/**", "test-ws/b", {includeEmptyDirs: true})
            waitForReady(() => {
                removeSync("test-ws/a/c")
                waitForRemove(() => {
                    verifyFiles()
                    done()
                })
            })
        })

        it("command version.", (done) => {
            command = execCommand("\"test-ws/a/**\" test-ws/b --include-empty-dirs --watch --verbose")
            waitForReady(() => {
                removeSync("test-ws/a/c")
                waitForRemove(() => {
                    verifyFiles()
                    done()
                })
            })
        })
    })

    describe("should copy it when a file is added even if '--no-initial' option was given:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/hello.txt": "Hello",
            })
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/b/hello.txt") === null)
            assert(content("test-ws/b/b/hello.txt") === null)
            assert(content("test-ws/b/added.txt") === "added")
        }

        it("lib version.", (done) => {
            watcher = cpx.watch("test-ws/a/**", "test-ws/b", {initialCopy: false})
            waitForReady(() => {
                writeFile("test-ws/a/added.txt", "added")
                waitForCopy(() => {
                    verifyFiles()
                    done()
                })
            })
        })

        it("command version.", (done) => {
            command = execCommand("\"test-ws/a/**\" test-ws/b --no-initial --watch --verbose")
            waitForReady(() => {
                writeFile("test-ws/a/added.txt", "added")
                waitForCopy(() => {
                    verifyFiles()
                    done()
                })
            })
        })
    })

    describe("should copy it when a file is modified even if there are parentheses in path:", () => {
        beforeEach(() => {
            setupTestDir({ //
                "test-ws/a(paren)/hello.txt": "Hello",
            })
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/a(paren)/hello.txt") === "Hello 2")
            assert(content("test-ws/b/hello.txt") === "Hello 2")
        }

        it("lib version.", (done) => {
            watcher = cpx.watch("test-ws/a(paren)/**", "test-ws/b", {initialCopy: false})
            waitForReady(() => {
                writeFile("test-ws/a(paren)/hello.txt", "Hello 2")
                waitForCopy(() => {
                    verifyFiles()
                    done()
                })
            })
        })

        it("command version.", (done) => {
            command = execCommand("\"test-ws/a(paren)/**\" test-ws/b --no-initial --watch --verbose")
            waitForReady(() => {
                writeFile("test-ws/a(paren)/hello.txt", "Hello 2")
                waitForCopy(() => {
                    verifyFiles()
                    done()
                })
            })
        })
    })
})
