#!/usr/bin/env node
/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const subarg = require("subarg")

//------------------------------------------------------------------------------
// Main
//------------------------------------------------------------------------------

// Parse arguments.
const unknowns = new Set()
const args = subarg(process.argv.slice(2), {
    alias: {
        c: "command",
        C: "clean",
        h: "help",
        includeEmptyDirs: "include-empty-dirs",
        L: "dereference",
        p: "preserve",
        t: "transform",
        u: "update",
        v: "verbose",
        V: "version",
        w: "watch",
    },
    boolean: [
        "clean",
        "dereference",
        "help",
        "include-empty-dirs",
        "initial",
        "preserve",
        "update",
        "verbose",
        "version",
        "watch",
    ],
    default: { initial: true },
    unknown(arg) {
        if (arg[0] === "-") {
            unknowns.add(arg)
        }
    },
})
const source = args._[0]
const outDir = args._[1]

// Validate Options.
if (unknowns.size > 0) {
    console.error(`Unknown option(s): ${Array.from(unknowns).join(", ")}`)
    process.exitCode = 1
}

// Main.
else if (args.help) {
    require("./help")()
} else if (args.version) {
    require("./version")()
} else if (source == null || outDir == null || args._.length > 2) {
    require("./help")()
    process.exitCode = 1
} else {
    require("./main")(source, outDir, args)
}
