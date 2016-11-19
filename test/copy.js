/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

const {symlinkSync, statSync, utimesSync} = require("fs")
const {resolve: resolvePath} = require("path")
const assert = require("power-assert")
const cpx = require("../src/lib")
const {
    setupTestDir,
    teardownTestDir,
    content,
    execCommandSync,
} = require("./util/util")
const upperify = require("./util/upperify")
const upperify2 = require("./util/upperify2")

describe("The copy method", () => {
    describe("should copy specified files with globs:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/untachable.txt": "untachable",
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/this-is.txt": "A pen",
                "test-ws/a/b/that-is.txt": "A note",
                "test-ws/a/b/no-copy.dat": "no-copy",
            })
        })
        afterEach(() => {
            teardownTestDir("test-ws")
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/untachable.txt") === "untachable")
            assert(content("test-ws/a/hello.txt") === "Hello")
            assert(content("test-ws/a/b/this-is.txt") === "A pen")
            assert(content("test-ws/a/b/that-is.txt") === "A note")
            assert(content("test-ws/a/b/no-copy.dat") === "no-copy")
            assert(content("test-ws/b/untachable.txt") === null)
            assert(content("test-ws/b/hello.txt") === "Hello")
            assert(content("test-ws/b/b/this-is.txt") === "A pen")
            assert(content("test-ws/b/b/that-is.txt") === "A note")
            assert(content("test-ws/b/b/no-copy.dat") === null)
        }

        it("lib async version.", (done) => {
            cpx.copy("test-ws/a/**/*.txt", "test-ws/b", (err) => {
                assert(err === null)
                verifyFiles()
                done()
            })
        })

        it("lib sync version.", () => {
            cpx.copySync("test-ws/a/**/*.txt", "test-ws/b")
            verifyFiles()
        })

        it("command version.", () => {
            execCommandSync("\"test-ws/a/**/*.txt\" test-ws/b")
            verifyFiles()
        })
    })

    describe("should clean and copy specified files with globs when give clean option:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/untachable.txt": "untachable",
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/this-is.txt": "A pen",
                "test-ws/a/b/that-is.txt": "A note",
                "test-ws/a/b/no-copy.dat": "no-copy",
                "test-ws/b/b/remove.txt": "remove",
                "test-ws/b/b/no-remove.dat": "no-remove",
            })
        })
        afterEach(() => {
            teardownTestDir("test-ws")
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/untachable.txt") === "untachable")
            assert(content("test-ws/a/hello.txt") === "Hello")
            assert(content("test-ws/a/b/this-is.txt") === "A pen")
            assert(content("test-ws/a/b/that-is.txt") === "A note")
            assert(content("test-ws/a/b/no-copy.dat") === "no-copy")
            assert(content("test-ws/b/untachable.txt") === null)
            assert(content("test-ws/b/hello.txt") === "Hello")
            assert(content("test-ws/b/b/this-is.txt") === "A pen")
            assert(content("test-ws/b/b/that-is.txt") === "A note")
            assert(content("test-ws/b/b/no-copy.dat") === null)
            assert(content("test-ws/b/b/remove.txt") === null)
            assert(content("test-ws/b/b/no-remove.dat") === "no-remove")
        }

        it("lib async version.", (done) => {
            cpx.copy("test-ws/a/**/*.txt", "test-ws/b", {clean: true}, (err) => {
                assert(err === null)
                verifyFiles()
                done()
            })
        })

        it("lib sync version.", () => {
            cpx.copySync("test-ws/a/**/*.txt", "test-ws/b", {clean: true})
            verifyFiles()
        })

        it("command version.", () => {
            execCommandSync("\"test-ws/a/**/*.txt\" test-ws/b --clean")
            verifyFiles()
        })
    })

    describe("should copy files inside of symlink directory when `--dereference` option was specified:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/src/a/hello.txt": "Symlinked",
                "test-ws/a/hello.txt": "Hello",
            })
            symlinkSync(
                resolvePath("test-ws/src"),
                resolvePath("test-ws/a/link"),
                "junction"
            )
        })
        afterEach(() => {
            teardownTestDir("test-ws")
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

        it("lib async version.", (done) => {
            cpx.copy("test-ws/a/**/*.txt", "test-ws/b", {dereference: true}, (err) => {
                assert(err === null)
                verifyFiles()
                done()
            })
        })

        it("lib sync version.", () => {
            cpx.copySync("test-ws/a/**/*.txt", "test-ws/b", {dereference: true})
            verifyFiles()
        })

        it("command version.", () => {
            execCommandSync("\"test-ws/a/**/*.txt\" test-ws/b --dereference")
            verifyFiles()
        })
    })

    describe("should copy specified empty directories with globs when `--include-empty-dirs` option was given:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/pen.txt": "A pen",
                "test-ws/a/c": null,
            })
        })
        afterEach(() => {
            teardownTestDir("test-ws")
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/a/hello.txt") === "Hello")
            assert(content("test-ws/a/b/pen.txt") === "A pen")
            assert(statSync("test-ws/a/c").isDirectory())
            assert(content("test-ws/b/hello.txt") === "Hello")
            assert(content("test-ws/b/b/pen.txt") === "A pen")
            assert(statSync("test-ws/b/c").isDirectory())
        }

        it("lib async version.", (done) => {
            cpx.copy("test-ws/a/**", "test-ws/b", {includeEmptyDirs: true}, (err) => {
                assert(err === null)
                verifyFiles()
                done()
            })
        })

        it("lib sync version.", () => {
            cpx.copySync("test-ws/a/**", "test-ws/b", {includeEmptyDirs: true})
            verifyFiles()
        })

        it("command version.", () => {
            execCommandSync("\"test-ws/a/**\" test-ws/b --include-empty-dirs")
            verifyFiles()
        })
    })

    describe("should not copy specified empty directories with globs when `--include-empty-dirs` option was not given:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/pen.txt": "A pen",
                "test-ws/a/c": null,
            })
        })
        afterEach(() => {
            teardownTestDir("test-ws")
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/a/hello.txt") === "Hello")
            assert(content("test-ws/a/b/pen.txt") === "A pen")
            assert(statSync("test-ws/a/c").isDirectory())
            assert(content("test-ws/b/hello.txt") === "Hello")
            assert(content("test-ws/b/b/pen.txt") === "A pen")
            assert.throws(() => statSync("test-ws/b/c"), /ENOENT/)
        }

        it("lib async version.", (done) => {
            cpx.copy("test-ws/a/**", "test-ws/b", (err) => {
                assert(err === null)
                verifyFiles()
                done()
            })
        })

        it("lib sync version.", () => {
            cpx.copySync("test-ws/a/**", "test-ws/b")
            verifyFiles()
        })

        it("command version.", () => {
            execCommandSync("\"test-ws/a/**\" test-ws/b")
            verifyFiles()
        })
    })

    describe("should copy specified files with globs when `--preserve` option was given:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/untachable.txt": "untachable",
                "test-ws/a/hello.txt": "Hello",
                "test-ws/a/b/this-is.txt": "A pen",
                "test-ws/a/b/that-is.txt": "A note",
                "test-ws/a/b/no-copy.dat": "no-copy",
            })
        })
        afterEach(() => {
            teardownTestDir("test-ws")
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/untachable.txt") === "untachable")
            assert(content("test-ws/a/hello.txt") === "Hello")
            assert(content("test-ws/a/b/this-is.txt") === "A pen")
            assert(content("test-ws/a/b/that-is.txt") === "A note")
            assert(content("test-ws/a/b/no-copy.dat") === "no-copy")
            assert(content("test-ws/b/untachable.txt") === null)
            assert(content("test-ws/b/hello.txt") === "Hello")
            assert(content("test-ws/b/b/this-is.txt") === "A pen")
            assert(content("test-ws/b/b/that-is.txt") === "A note")
            assert(content("test-ws/b/b/no-copy.dat") === null)
        }

        it("lib async version.", (done) => {
            cpx.copy("test-ws/a/**/*.txt", "test-ws/b", {preserve: true}, (err) => {
                assert(err === null)
                verifyFiles()
                done()
            })
        })

        it("lib sync version.", () => {
            cpx.copySync("test-ws/a/**/*.txt", "test-ws/b", {preserve: true})
            verifyFiles()
        })

        it("command version.", () => {
            execCommandSync("\"test-ws/a/**/*.txt\" test-ws/b --preserve")
            verifyFiles()
        })
    })

    describe("should not copy attributes when `--preserve` option was not given:", () => {
        afterEach(() => {
            teardownTestDir("test-ws")
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            const srcStat = statSync("./LICENSE")
            const dstStat = statSync("./test-ws/LICENSE")
            const srcMtime = Math.floor(srcStat.mtime.getTime() / 1000)
            const dstMtime = Math.floor(dstStat.mtime.getTime() / 1000)

            assert(srcMtime !== dstMtime)
        }

        it("lib async version.", (done) => {
            cpx.copy("LICENSE", "test-ws", (err) => {
                assert(err === null)
                verifyFiles()
                done()
            })
        })

        it("lib sync version.", () => {
            cpx.copySync("LICENSE", "test-ws")
            verifyFiles()
        })

        it("command version.", () => {
            execCommandSync("LICENSE test-ws")
            verifyFiles()
        })
    })

    describe("should copy attributes when `--preserve` option was given:", () => {
        afterEach(() => {
            teardownTestDir("test-ws")
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            const srcStat = statSync("./LICENSE")
            const dstStat = statSync("./test-ws/LICENSE")
            const srcMtime = Math.floor(srcStat.mtime.getTime() / 1000)
            const dstMtime = Math.floor(dstStat.mtime.getTime() / 1000)

            assert(srcStat.uid === dstStat.uid)
            assert(srcStat.gid === dstStat.gid)
            assert(srcMtime === dstMtime)
        }

        it("lib async version.", (done) => {
            cpx.copy("LICENSE", "test-ws", {preserve: true}, (err) => {
                assert(err === null)
                verifyFiles()
                done()
            })
        })

        it("lib sync version.", () => {
            cpx.copySync("LICENSE", "test-ws", {preserve: true})
            verifyFiles()
        })

        it("command version.", () => {
            execCommandSync("LICENSE test-ws --preserve")
            verifyFiles()
        })
    })

    describe("should not copy specified files if the source file is older than the destination file, when `--update` option was given:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/a.txt": "newer source",
                "test-ws/b.txt": "older source",
                "test-ws/a/a.txt": "older destination",
                "test-ws/a/b.txt": "newer destination",
            })

            const older = Date.now() / 1000
            const newer = older + 1
            utimesSync("test-ws/a.txt", newer, newer)
            utimesSync("test-ws/b.txt", older, older)
            utimesSync("test-ws/a/a.txt", older, older)
            utimesSync("test-ws/a/b.txt", newer, newer)
        })
        afterEach(() => {
            teardownTestDir("test-ws")
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/a.txt") === "newer source")
            assert(content("test-ws/b.txt") === "older source")
            assert(content("test-ws/a/a.txt") === "newer source")
            assert(content("test-ws/a/b.txt") === "newer destination")
        }

        it("lib async version.", (done) => {
            cpx.copy("test-ws/*.txt", "test-ws/a", {update: true}, (err) => {
                assert(err === null)
                verifyFiles()
                done()
            })
        })

        it("lib sync version.", () => {
            cpx.copySync("test-ws/*.txt", "test-ws/a", {update: true})
            verifyFiles()
        })

        it("command version.", () => {
            execCommandSync("\"test-ws/*.txt\" test-ws/a --update")
            verifyFiles()
        })
    })

    describe("should copy specified files when `--update` option was not given:", () => {
        beforeEach(() => {
            setupTestDir({
                "test-ws/a.txt": "newer source",
                "test-ws/b.txt": "older source",
                "test-ws/a/a.txt": "older destination",
                "test-ws/a/b.txt": "newer destination",
            })

            const older = Date.now() / 1000
            const newer = older + 1
            utimesSync("test-ws/a.txt", newer, newer)
            utimesSync("test-ws/b.txt", older, older)
            utimesSync("test-ws/a/a.txt", older, older)
            utimesSync("test-ws/a/b.txt", newer, newer)
        })
        afterEach(() => {
            teardownTestDir("test-ws")
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/a.txt") === "newer source")
            assert(content("test-ws/b.txt") === "older source")
            assert(content("test-ws/a/a.txt") === "newer source")
            assert(content("test-ws/a/b.txt") === "older source")
        }

        it("lib async version.", (done) => {
            cpx.copy("test-ws/*.txt", "test-ws/a", (err) => {
                assert(err === null)
                verifyFiles()
                done()
            })
        })

        it("lib sync version.", () => {
            cpx.copySync("test-ws/*.txt", "test-ws/a")
            verifyFiles()
        })

        it("command version.", () => {
            execCommandSync("\"test-ws/*.txt\" test-ws/a")
            verifyFiles()
        })
    })

    describe("should copy with transforming when `--command` option was specified.", () => {
        beforeEach(() => {
            setupTestDir({"test-ws/a/hello.txt": "Hello"})
        })
        afterEach(() => {
            teardownTestDir("test-ws")
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/b/hello.txt") === "HELLO")
        }

        it("command version.", () => {
            execCommandSync("\"test-ws/a/**/*.txt\" test-ws/b --command \"node ./test/util/upperify.js\"")
            verifyFiles()
        })
    })

    describe("should copy with transforming when `--command` option was specified (it does not have 'destroy' method).", () => {
        beforeEach(() => {
            setupTestDir({"test-ws/a/hello.txt": "Hello"})
        })
        afterEach(() => {
            teardownTestDir("test-ws")
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/b/hello.txt") === "HELLO")
        }

        it("command version.", () => {
            execCommandSync("\"test-ws/a/**/*.txt\" test-ws/b --command \"node ./test/util/upperify2.js\"")
            verifyFiles()
        })
    })

    describe("should copy with transforming when `--transform` option was specified.", () => {
        beforeEach(() => {
            setupTestDir({"test-ws/a/hello.txt": "Hello"})
        })
        afterEach(() => {
            teardownTestDir("test-ws")
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/b/hello.txt") === "HELLO")
        }

        it("lib async version.", (done) => {
            cpx.copy("test-ws/a/**/*.txt", "test-ws/b", {transform: upperify}, (err) => {
                assert(err === null)
                verifyFiles()
                done()
            })
        })

        it("should throw an error on lib sync version (cannot use streaming api).", () => {
            assert.throws(() => {
                cpx.copySync("test-ws/a/**/*.txt", "test-ws/b", {transform: upperify})
            }, Error)
        })

        it("command version.", () => {
            execCommandSync("\"test-ws/a/**/*.txt\" test-ws/b --transform ./test/util/upperify")
            verifyFiles()
        })
    })

    describe("should copy with transforming when `--transform` option was specified (it does not have 'destroy' method).", () => {
        beforeEach(() => {
            setupTestDir({"test-ws/a/hello.txt": "Hello"})
        })
        afterEach(() => {
            teardownTestDir("test-ws")
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/b/hello.txt") === "HELLO")
        }

        it("lib async version.", (done) => {
            cpx.copy("test-ws/a/**/*.txt", "test-ws/b", {transform: upperify2}, (err) => {
                assert(err === null)
                verifyFiles()
                done()
            })
        })

        it("should throw an error on lib sync version (cannot use streaming api).", () => {
            assert.throws(() => {
                cpx.copySync("test-ws/a/**/*.txt", "test-ws/b", {transform: upperify2})
            }, Error)
        })

        it("command version.", () => {
            execCommandSync("\"test-ws/a/**/*.txt\" test-ws/b --transform ./test/util/upperify2")
            verifyFiles()
        })
    })

    describe("should keep order when a mix of -c and -t was specified.", () => {
        beforeEach(() => {
            setupTestDir({"test-ws/a/hello.txt": "Hello"})
        })
        afterEach(() => {
            teardownTestDir("test-ws")
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/b/hello.txt") === "Helloabcd")
        }

        it("command version.", () => {
            execCommandSync("\"test-ws/a/**/*.txt\" test-ws/b -c \"node ./test/util/appendify.js a\" -t [./test/util/appendify b] -c \"node ./test/util/appendify.js c\" -t [./test/util/appendify d]")
            verifyFiles()
        })
    })

    describe("should copy as expected even if a specific path didn't include `/`.", () => {
        beforeEach(() => {
            setupTestDir({"hello.txt": "Hello"})
        })
        afterEach(() => {
            teardownTestDir("hello.txt")
            teardownTestDir("test-ws")
        })

        /**
         * Verify.
         * @returns {void}
         */
        function verifyFiles() {
            assert(content("test-ws/hello.txt") === "Hello")
        }

        it("lib async version.", (done) => {
            cpx.copy("hello.txt", "test-ws", (err) => {
                assert(err === null)
                verifyFiles()
                done()
            })
        })

        it("lib sync version.", () => {
            cpx.copySync("hello.txt", "test-ws")
            verifyFiles()
        })

        it("command version.", () => {
            execCommandSync("hello.txt test-ws")
            verifyFiles()
        })
    })
})
