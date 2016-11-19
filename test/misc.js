/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

const assert = require("power-assert")
const {execCommandSync} = require("./util/util")

describe("[misc]", () => {
    it("should throw error if invalid option was given.", () => {
        const result = execCommandSync("\"test-ws/a/**/*.txt\" test-ws/b --invalid")

        assert(result.code === 1)
        assert(result.stderr === "Unknown option(s): --invalid\n")
    })

    it("should throw error if invalid options were given.", () => {
        const result = execCommandSync("\"test-ws/a/**/*.txt\" test-ws/b --invalid --foo --bar")

        assert(result.code === 1)
        assert(result.stderr === "Unknown option(s): --invalid, --foo, --bar\n")
    })

    it("should throw error and show help if <source> and <dest> were lacking.", () => {
        const result = execCommandSync("")

        assert(result.code === 1)
        assert(/Usage:/.test(result.stdout))
    })

    it("should throw error and show help if <dest> was lacking.", () => {
        const result = execCommandSync("test-ws/**/*.js")

        assert(result.code === 1)
        assert(/Usage:/.test(result.stdout))
    })

    it("should show help if --help option was given.", () => {
        const result = execCommandSync("--help")

        assert(result.code === 0)
        assert(/Usage:/.test(result.stdout))
    })

    it("should show help if -h option was given.", () => {
        const result = execCommandSync("--help")

        assert(result.code === 0)
        assert(/Usage:/.test(result.stdout))
    })

    it("should show version if --version option was given.", () => {
        const result = execCommandSync("--version")

        assert(result.code === 0)
        assert(/^v[0-9]+\.[0-9]+\.[0-9]+\n$/.test(result.stdout))
    })

    it("should show version if -V option was given.", () => {
        const result = execCommandSync("-V")

        assert(result.code === 0)
        assert(/^v[0-9]+\.[0-9]+\.[0-9]+\n$/.test(result.stdout))
    })
})
