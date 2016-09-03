#!/usr/bin/env node

/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
/* eslint no-console:0, no-process-exit:0 */

"use strict"

const subarg = require("subarg")

//------------------------------------------------------------------------------
// Parse arguments.
const OPTIONS = {
    c: "command",
    C: "clean",
    h: "help",
    L: "dereference",
    t: "transform",
    v: "verbose",
    V: "version",
    w: "watch",
}
const args = subarg(process.argv.slice(2), {
    boolean: ["clean", "dereference", "help", "verbose", "version", "watch"],
    alias: OPTIONS,
})
const source = args._[0]
const outDir = args._[1]

//------------------------------------------------------------------------------
// Validate Options.
const knowns = new Set(["_"])
for (const key in OPTIONS) {
    knowns.add(key)
    knowns.add(OPTIONS[key])
}
const unknowns = Object.keys(args).filter(key => !knowns.has(key))
if (unknowns.length > 0) {
    console.error(`Unknown option(s): ${unknowns.join(", ")}`)
    process.exit(1)
}

//------------------------------------------------------------------------------
// Main.
if (args.help) {
    require("./help")()
}
else if (args.version) {
    require("./version")()
}
else if (source == null || outDir == null || args._.length > 2) {
    require("./help")()
    process.exit(1)
}
else {
    require("./main")(source, outDir, args)
}
