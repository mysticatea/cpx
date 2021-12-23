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

    afterEach(async () => {
        if (watcher) {
            watcher.close()
            watcher = null
        }
        if (command) {
            command.stdin.write("KILL")
            await pEvent(command, "exit")
            await teardownTestDir("test-ws")
            command = null // eslint-disable-line require-atomic-updates
        } else {
            await teardownTestDir("test-ws")
        }
    })

    /**
     * Wait for ready.
     * @returns {Promise<void>} The promise which will go fulfilled after done.
     */
    async function waitForReady() {
        if (watcher) {
            await pEvent(watcher, "watch-ready")
        } else if (command) {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const chunk = await pEvent(command.stdout, "data")
                if (chunk.indexOf("Be watching") >= 0) {
                    break
                }
            }
        }
        await delay(250)
    }

    /**
     * Wait for a copy.
     * @returns {Promise<void>} The promise which will go fulfilled after done.
     */
    async function waitForCopy() {
        if (watcher) {
            await pEvent(watcher, "copy")
        } else if (command) {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const chunk = await pEvent(command.stdout, "data")
                if (chunk.indexOf("Copied:") >= 0) {
                    break
                }
            }
        }
        await delay(250)
    }

    /**
     * Wait for a remove.
     * @returns {Promise<void>} The promise which will go fulfilled after done.
     */
    async function waitForRemove() {
        if (watcher) {
            await pEvent(watcher, "remove")
        } else if (command) {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const chunk = await pEvent(command.stdout, "data")
                if (chunk.indexOf("Removed:") >= 0) {
                    break
                }
            }
        }
        await delay(250)
    }

    //==========================================================================

    describe("should copy specified files with globs at first:", () => {
        beforeEach(() =>
            setupTestDir({
                "test-ws/untouchable.txt": "untouchable",
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/this-is.txt": "A pen",
                "test-ws/a/b/that-is.txt": "A note",
                "test-ws/a/b/no-copy.dat": "no-copy",
            })
        )

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

        it("lib version.", async () => {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b")
            await waitForReady()
            await verifyFiles()
        })

        it("command version.", async () => {
            command = execCommand(
                '"test-ws/a/**/*.txt" test-ws/b --watch --verbose'
            )
            await waitForReady()
            await verifyFiles()
        })
    })

    describe("should copy files in symlink directory at first when `--dereference` option was given:", () => {
        beforeEach(async () => {
            await setupTestDir({
                "test-ws/src/a/hello.txt": "Symlinked",
                "test-ws/a/hello.txt": "Hello",
            })
            await fs.symlink(
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
            return verifyTestDir({
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/link/a/hello.txt": "Symlinked",
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/link/a/hello.txt": "Symlinked",
            })
        }

        it("lib version.", async () => {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b", {
                dereference: true,
            })
            await waitForReady()
            await verifyFiles()
        })

        it("command version.", async () => {
            command = execCommand(
                '"test-ws/a/**/*.txt" test-ws/b --watch --dereference --verbose'
            )
            await waitForReady()
            await verifyFiles()
        })
    })

    describe("should not copy files in symlink directory when `--dereference` option was not given:", () => {
        beforeEach(async () => {
            await setupTestDir({
                "test-ws/src/a/hello.txt": "Symlinked",
                "test-ws/a/hello.txt": "Hello",
            })
            await fs.symlink(
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
            return verifyTestDir({
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/link/a/hello.txt": "Symlinked",
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/link/a/hello.txt": null,
            })
        }

        it("lib version.", async () => {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b", {
                dereference: false,
            })
            await waitForReady()
            await verifyFiles()
        })

        it("command version.", async () => {
            command = execCommand(
                '"test-ws/a/**/*.txt" test-ws/b --watch --verbose'
            )
            await waitForReady()
            await verifyFiles()
        })
    })

    describe("should copy specified files with globs at first even if the glob starts with `./`:", () => {
        beforeEach(() =>
            setupTestDir({
                "test-ws/untouchable.txt": "untouchable",
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/this-is.txt": "A pen",
                "test-ws/a/b/that-is.txt": "A note",
                "test-ws/a/b/no-copy.dat": "no-copy",
            })
        )

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

        it("lib version.", async () => {
            watcher = cpx.watch("./test-ws/a/**/*.txt", "test-ws/b")
            await waitForReady()
            await verifyFiles()
        })

        it("command version.", async () => {
            command = execCommand(
                '"./test-ws/a/**/*.txt" test-ws/b --watch --verbose'
            )
            await waitForReady()
            await verifyFiles()
        })
    })

    describe("should clean and copy specified file blobs at first when give clean option:", () => {
        beforeEach(() =>
            setupTestDir({
                "test-ws/untouchable.txt": "untouchable",
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/this-is.txt": "A pen",
                "test-ws/a/b/that-is.txt": "A note",
                "test-ws/a/b/no-copy.dat": "no-copy",
                "test-ws/b/b/remove.txt": "remove",
                "test-ws/b/b/no-remove.dat": "no-remove",
            })
        )

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

        it("lib version.", async () => {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b", {
                clean: true,
            })
            await waitForReady()
            await verifyFiles()
        })

        it("command version.", async () => {
            command = execCommand(
                '"test-ws/a/**/*.txt" test-ws/b --clean --watch --verbose'
            )
            await waitForReady()
            await verifyFiles()
        })
    })

    describe("should not copy specified files with globs at first when `--no-initial` option was given:", () => {
        beforeEach(() =>
            setupTestDir({
                "test-ws/untouchable.txt": "untouchable",
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/this-is.txt": "A pen",
                "test-ws/a/b/that-is.txt": "A note",
                "test-ws/a/b/no-copy.dat": "no-copy",
            })
        )

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

        it("lib version.", async () => {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b", {
                initialCopy: false,
            })
            await waitForReady()
            await verifyFiles()
        })

        it("command version.", async () => {
            command = execCommand(
                '"test-ws/a/**/*.txt" test-ws/b --no-initial --watch --verbose'
            )
            await waitForReady()
            await verifyFiles()
        })
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
            description:
                "should do nothing on file added if unmatch file globs:",
            initialFiles: { "test-ws/a/hello.txt": "Hello" },
            action() {
                async function run() {
                    await writeFile("test-ws/a/b/not-added.dat", "added")
                    await writeFile("test-ws/a/a.txt", "a")
                }

                return run()
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
            description:
                "should do nothing on file changed if unmatch file globs:",
            initialFiles: {
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/hello.dat": "Hello",
            },
            action() {
                async function run() {
                    await writeFile("test-ws/a/hello.dat", "changed")
                    await writeFile("test-ws/a/a.txt", "a")
                }

                return run()
            },
            verify: {
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/hello.dat": null,
            },
            wait: waitForCopy,
        },
        {
            description:
                "should remove in the destination directory on file removed:",
            initialFiles: { "test-ws/a/hello.txt": "Hello" },
            action() {
                return removeFile("test-ws/a/hello.txt")
            },
            verify: { "test-ws/b/hello.txt": null },
            wait: waitForRemove,
        },
        {
            description:
                "should do nothing on file removed if unmatch file globs:",
            initialFiles: {
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/hello.dat": "Hello",
            },
            action() {
                async function run() {
                    await removeFile("test-ws/a/hello.dat")
                    await writeFile("test-ws/a/hello.txt", "changed")
                }

                return run()
            },
            verify: {
                "test-ws/b/hello.txt": "changed",
                "test-ws/b/hello.dat": null,
            },
            wait: waitForCopy,
        },
    ]
    for (const pattern of patterns) {
        //eslint-disable-next-line no-loop-func
        ;(pattern.only ? describe.only : describe)(pattern.description, () => {
            beforeEach(() => setupTestDir(pattern.initialFiles))

            it("lib version.", async () => {
                watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b")
                await waitForReady()
                await pattern.action()
                await pattern.wait()
                await verifyTestDir(pattern.verify)
            })

            it("command version.", async () => {
                command = execCommand(
                    '"test-ws/a/**/*.txt" test-ws/b --watch --verbose'
                )
                await waitForReady()
                await pattern.action()
                await pattern.wait()
                await verifyTestDir(pattern.verify)
            })
        })
    }

    const patternsWithIgnore = [
        {
            description: "should ignore ignored files:",
            initialFiles: {
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/node_modules/dont-copy.txt": "no-copy",
            },
            action() {
                return writeFile("test-ws/a/b/added.txt", "added")
            },
            verify: {
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/b/added.txt": "added",
                "test-ws/a/node_modules/dont-copy.txt": "no-copy",
                "test-ws/b/node_modules/dont-copy.txt": null,
            },
            wait: waitForCopy,
            ignore: ["node_modules"],
        },
    ]
    for (const pattern of patternsWithIgnore) {
        //eslint-disable-next-line no-loop-func
        ;(pattern.only ? describe.only : describe)(pattern.description, () => {
            beforeEach(() => setupTestDir(pattern.initialFiles))

            it("lib version.", async () => {
                watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b", {
                    ignore: pattern.ignore,
                })
                await waitForReady()
                await pattern.action()
                await pattern.wait()
                await verifyTestDir(pattern.verify)
            })

            it("command version.", async () => {
                command = execCommand(
                    `"test-ws/a/**/*.txt" test-ws/b --watch --verbose --ignore ${pattern.ignore.join(
                        ","
                    )}`
                )
                await waitForReady()
                await pattern.action()
                await pattern.wait()
                await verifyTestDir(pattern.verify)
            })
        })
    }

    describe("should copy and watch file from a parent dir:", () => {
        const pattern = {
            initialFiles: {
                "test-ws/a/hello.txt": "Hello",
                "test-ws/example.txt": "intial copy",
            },
            action() {
                return writeFile("../example.txt", "updated file")
            },
            verify: {
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/example.txt": "updated file",
            },
            wait: waitForCopy,
        }

        beforeEach(() => setupTestDir(pattern.initialFiles))

        it("lib version", async () => {
            const startingCwd = process.cwd()
            process.chdir(path.join(startingCwd, "test-ws/a"))
            watcher = cpx.watch("../example.txt", ".")
            await waitForReady()
            await pattern.action()
            await pattern.wait()
            process.chdir(startingCwd)
            await verifyTestDir(pattern.verify)
        })
    })

    describe("should do reactions of multiple events:", () => {
        beforeEach(() =>
            setupTestDir({
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/hello.dat": "Hello",
            })
        )

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

        it("lib version.", async () => {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b")
            await waitForReady()
            await removeFile("test-ws/a/hello.dat")
            await removeFile("test-ws/a/hello.txt")
            await writeFile("test-ws/a/added.dat", "added_data")
            await writeFile("test-ws/a/added.txt", "added")
            await waitForCopy()
            await verifyFiles()
        })

        it("command version.", async () => {
            command = execCommand(
                '"test-ws/a/**/*.txt" test-ws/b --watch --verbose'
            )
            await waitForReady()
            await removeFile("test-ws/a/hello.dat")
            await removeFile("test-ws/a/hello.txt")
            await writeFile("test-ws/a/added.dat", "added_data")
            await writeFile("test-ws/a/added.txt", "added")
            await waitForCopy()
            await verifyFiles()
        })
    })

    describe("should copy it when an empty directory is added when '--include-empty-dirs' option was given:", () => {
        beforeEach(() =>
            setupTestDir({
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/hello.txt": "Hello",
            })
        )

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

        it("lib version.", async () => {
            watcher = cpx.watch("test-ws/a/**", "test-ws/b", {
                includeEmptyDirs: true,
            })
            await waitForReady()
            await ensureDir("test-ws/a/c")
            await waitForCopy()
            await verifyFiles()
        })

        it("command version.", async () => {
            command = execCommand(
                '"test-ws/a/**" test-ws/b --include-empty-dirs --watch --verbose'
            )
            await waitForReady()
            await ensureDir("test-ws/a/c")
            await waitForCopy()
            await verifyFiles()
        })
    })

    describe("should remove it on destination when an empty directory is removed when '--include-empty-dirs' option was given:", () => {
        beforeEach(() =>
            setupTestDir({
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/hello.txt": "Hello",
                "test-ws/a/c": null,
            })
        )

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert.throws(() => fs.statSync("test-ws/b/c"), /ENOENT/u)
            return verifyTestDir({
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/b/hello.txt": "Hello",
            })
        }

        it("lib version.", async () => {
            watcher = cpx.watch("test-ws/a/**", "test-ws/b", {
                includeEmptyDirs: true,
            })
            await waitForReady()
            await remove("test-ws/a/c")
            await waitForRemove()
            await verifyFiles()
        })

        it("command version.", async () => {
            command = execCommand(
                '"test-ws/a/**" test-ws/b --include-empty-dirs --watch --verbose'
            )
            await waitForReady()
            await remove("test-ws/a/c")
            await waitForRemove()
            await verifyFiles()
        })
    })

    describe("should copy it when a file is added even if '--no-initial' option was given:", () => {
        beforeEach(() =>
            setupTestDir({
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/hello.txt": "Hello",
            })
        )

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

        it("lib version.", async () => {
            watcher = cpx.watch("test-ws/a/**", "test-ws/b", {
                initialCopy: false,
            })
            await waitForReady()
            await writeFile("test-ws/a/added.txt", "added")
            await waitForCopy()
            await verifyFiles()
        })

        it("command version.", async () => {
            command = execCommand(
                '"test-ws/a/**" test-ws/b --no-initial --watch --verbose'
            )
            await waitForReady()
            await writeFile("test-ws/a/added.txt", "added")
            await waitForCopy()
            await verifyFiles()
        })
    })

    describe("should copy it when a file is modified even if there are parentheses in path:", () => {
        beforeEach(() =>
            setupTestDir({
                //
                "test-ws/a(paren)/hello.txt": "Hello",
            })
        )

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

        it("lib version.", async () => {
            watcher = cpx.watch("test-ws/a(paren)/**", "test-ws/b", {
                initialCopy: false,
            })
            await waitForReady()
            await writeFile("test-ws/a(paren)/hello.txt", "Hello 2")
            await waitForCopy()
            await verifyFiles()
        })

        it("command version.", async () => {
            command = execCommand(
                '"test-ws/a(paren)/**" test-ws/b --no-initial --watch --verbose'
            )
            await waitForReady()
            await writeFile("test-ws/a(paren)/hello.txt", "Hello 2")
            await waitForCopy()
            await verifyFiles()
        })
    })
})
