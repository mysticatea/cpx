/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */

"use strict";

const {symlinkSync} = require("fs");
const {resolve: resolvePath} = require("path");
const assert = require("power-assert");
const cpx = require("../src/lib");
const {
    setupTestDir,
    teardownTestDir,
    content,
    writeFile,
    removeFile,
    execCommand
} = require("./util/util");

describe("The watch method", () => {
    let watcher = null;
    let command = null;

    afterEach(done => {
        if (watcher) {
            watcher.close();
            watcher = null;
        }
        if (command) {
            command.stdin.write("KILL");
            command.on("exit", () => {
                teardownTestDir("test-ws");
                done();
            });
            command = null;
        }
        else {
            teardownTestDir("test-ws");
            done();
        }
    });

    /**
     * Wait for ready.
     * @param {function} cb - A callback function.
     * @returns {void}
     */
    function waitForReady(cb) {
        if (watcher) {
            watcher.on("watch-ready", function listener() {
                watcher.removeListener("watch-ready", listener);
                cb();
            });
        }
        else if (command) {
            command.stdout.on("data", function listener(chunk) {
                // Done the first copies.
                if (chunk.indexOf("Be watching in") >= 0) {
                    command.stdout.removeListener("data", listener);
                    cb();
                }
            });
        }
        else {
            cb();
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
                watcher.removeListener("copy", listener);
                cb();
            });
        }
        else if (command) {
            command.stdout.on("data", function listener(chunk) {
                // Done the first copies.
                if (chunk.indexOf("Copied: ") >= 0) {
                    command.stdout.removeListener("data", listener);
                    cb();
                }
            });
        }
        else {
            cb();
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
                watcher.removeListener("remove", listener);
                cb();
            });
        }
        else if (command) {
            command.stdout.on("data", function listener(chunk) {
                // Done the first copies.
                if (chunk.indexOf("Removed: ") >= 0) {
                    command.stdout.removeListener("data", listener);
                    cb();
                }
            });
        }
        else {
            cb();
        }
    }

    //==========================================================================

    describe("should copy specified files with globs at first:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/untachable.txt": "untachable",
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/this-is.txt": "A pen",
                "test-ws/a/b/that-is.txt": "A note",
                "test-ws/a/b/no-copy.dat": "no-copy"
            });
        });

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/untachable.txt") === "untachable");
            assert(content("test-ws/a/hello.txt") === "Hello");
            assert(content("test-ws/a/b/this-is.txt") === "A pen");
            assert(content("test-ws/a/b/that-is.txt") === "A note");
            assert(content("test-ws/a/b/no-copy.dat") === "no-copy");
            assert(content("test-ws/b/untachable.txt") === null);
            assert(content("test-ws/b/hello.txt") === "Hello");
            assert(content("test-ws/b/b/this-is.txt") === "A pen");
            assert(content("test-ws/b/b/that-is.txt") === "A note");
            assert(content("test-ws/b/b/no-copy.dat") === null);
        }

        it("lib version.", (done) => {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b");
            watcher.on("watch-ready", () => {
                // Done the first copies.
                verifyFiles();
                done();
            });
        });

        it("command version.", (done) => {
            command = execCommand("\"test-ws/a/**/*.txt\" test-ws/b --watch --verbose");
            waitForReady(() => {
                verifyFiles();
                done();
            });
        });
    });

    describe("should copy files in symlink directory at first when `--dereference` option was given:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/src/a/hello.txt": "Symlinked",
                "test-ws/a/hello.txt": "Hello"
            });
            symlinkSync(
                resolvePath("test-ws/src"),
                resolvePath("test-ws/a/link"),
                "junction"
            );
        });

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/a/hello.txt") === "Hello");
            assert(content("test-ws/a/link/a/hello.txt") === "Symlinked");
            assert(content("test-ws/b/hello.txt") === "Hello");
            assert(content("test-ws/b/link/a/hello.txt") === "Symlinked");
        }

        it("lib version.", (done) => {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b", {dereference: true});
            watcher.on("watch-ready", () => {
                // Done the first copies.
                verifyFiles();
                done();
            });
        });

        it("command version.", (done) => {
            command = execCommand("\"test-ws/a/**/*.txt\" test-ws/b --watch --dereference --verbose");
            waitForReady(() => {
                verifyFiles();
                done();
            });
        });
    });

    describe("should copy specified files with globs at first even if the glob starts with `./`:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/untachable.txt": "untachable",
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/this-is.txt": "A pen",
                "test-ws/a/b/that-is.txt": "A note",
                "test-ws/a/b/no-copy.dat": "no-copy"
            });
        });

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/untachable.txt") === "untachable");
            assert(content("test-ws/a/hello.txt") === "Hello");
            assert(content("test-ws/a/b/this-is.txt") === "A pen");
            assert(content("test-ws/a/b/that-is.txt") === "A note");
            assert(content("test-ws/a/b/no-copy.dat") === "no-copy");
            assert(content("test-ws/b/untachable.txt") === null);
            assert(content("test-ws/b/hello.txt") === "Hello");
            assert(content("test-ws/b/b/this-is.txt") === "A pen");
            assert(content("test-ws/b/b/that-is.txt") === "A note");
            assert(content("test-ws/b/b/no-copy.dat") === null);
        }

        it("lib version.", (done) => {
            watcher = cpx.watch("./test-ws/a/**/*.txt", "test-ws/b");
            watcher.on("watch-ready", () => {
                // Done the first copies.
                verifyFiles();
                done();
            });
        });

        it("command version.", (done) => {
            command = execCommand("\"./test-ws/a/**/*.txt\" test-ws/b --watch --verbose");
            waitForReady(() => {
                verifyFiles();
                done();
            });
        });
    });

    describe("should clean and copy specified file blobs at first when give clean option:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/untachable.txt": "untachable",
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/this-is.txt": "A pen",
                "test-ws/a/b/that-is.txt": "A note",
                "test-ws/a/b/no-copy.dat": "no-copy",
                "test-ws/b/b/remove.txt": "remove",
                "test-ws/b/b/no-remove.dat": "no-remove"
            });
        });

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/untachable.txt") === "untachable");
            assert(content("test-ws/a/hello.txt") === "Hello");
            assert(content("test-ws/a/b/this-is.txt") === "A pen");
            assert(content("test-ws/a/b/that-is.txt") === "A note");
            assert(content("test-ws/a/b/no-copy.dat") === "no-copy");
            assert(content("test-ws/b/untachable.txt") === null);
            assert(content("test-ws/b/hello.txt") === "Hello");
            assert(content("test-ws/b/b/this-is.txt") === "A pen");
            assert(content("test-ws/b/b/that-is.txt") === "A note");
            assert(content("test-ws/b/b/no-copy.dat") === null);
            assert(content("test-ws/b/b/remove.txt") === null);
            assert(content("test-ws/b/b/no-remove.dat") === "no-remove");
        }

        it("lib version.", (done) => {
            watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b", {clean: true});
            waitForReady(() => {
                // Done the first copies.
                verifyFiles();
                done();
            });
        });

        it("command version.", (done) => {
            command = execCommand("\"test-ws/a/**/*.txt\" test-ws/b --clean --watch --verbose");
            waitForReady(() => {
                verifyFiles();
                done();
            });
        });
    });

    [
        {
            description: "should copy on file added:",
            initialFiles: {
                "test-ws/a/hello.txt": "Hello"
            },
            action: () => {
                writeFile("test-ws/a/b/added.txt", "added");
            },
            verify: {
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/b/added.txt": "added"
            },
            wait: waitForCopy
        },
        {
            description: "should do nothing on file added if unmatch file globs:",
            initialFiles: {
                "test-ws/a/hello.txt": "Hello"
            },
            action: () => {
                writeFile("test-ws/a/b/not-added.dat", "added");
                // To fire copy event.
                writeFile("test-ws/a/a.txt", "a");
            },
            verify: {
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/b/not-added.dat": null
            },
            wait: waitForCopy
        },
        {
            description: "should copy on file changed:",
            initialFiles: {
                "test-ws/a/hello.txt": "Hello"
            },
            action: () => {
                writeFile("test-ws/a/hello.txt", "changed");
            },
            verify: {
                "test-ws/b/hello.txt": "changed"
            },
            wait: waitForCopy
        },
        {
            description: "should do nothing on file changed if unmatch file globs:",
            initialFiles: {
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/hello.dat": "Hello"
            },
            action: () => {
                writeFile("test-ws/a/hello.dat", "changed");
                // To fire copy event.
                writeFile("test-ws/a/a.txt", "a");
            },
            verify: {
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/hello.dat": null
            },
            wait: waitForCopy
        },
        {
            description: "should remove in the destination directory on file removed:",
            initialFiles: {
                "test-ws/a/hello.txt": "Hello"
            },
            action: () => {
                removeFile("test-ws/a/hello.txt");
            },
            verify: {
                "test-ws/b/hello.txt": null
            },
            wait: waitForRemove
        },
        {
            description: "should do nothing on file removed if unmatch file globs:",
            initialFiles: {
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/hello.dat": "Hello"
            },
            action: () => {
                removeFile("test-ws/a/hello.dat");
                // To fire copy event.
                writeFile("test-ws/a/a.txt", "a");
            },
            verify: {
                "test-ws/b/hello.txt": "Hello",
                "test-ws/b/hello.dat": null
            },
            wait: waitForCopy
        }
    ].forEach(item => {
        describe(item.description, () => {
            beforeEach(() => {
                setupTestDir(item.initialFiles);
            });

            /**
             * Verify.
             * @returns {void}
             */
            function verifyFiles() {
                for (const file in item.verify) {
                    assert(content(file) === item.verify[file]);
                }
            }

            it("lib version.", (done) => {
                watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b");
                waitForReady(() => {
                    item.action();
                    item.wait(() => {
                        verifyFiles();
                        done();
                    });
                });
            });

            it("command version.", (done) => {
                command = execCommand("\"test-ws/a/**/*.txt\" test-ws/b --watch --verbose");
                waitForReady(() => {
                    item.action();
                    item.wait(() => {
                        verifyFiles();
                        done();
                    });
                });
            });
        });
    });
});
