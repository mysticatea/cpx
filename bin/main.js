/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//TODO: remove.
/*eslint-disable no-process-exit, no-process-env */

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const resolvePath = require("path").resolve
const spawn = require("child_process").spawn
const resolveModule = require("resolve").sync
const parseShellQuote = require("shell-quote").parse
const duplexer = require("duplexer")
const Cpx = require("../lib/cpx")

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

module.exports = function main(source, outDir, args) {
    // Resolve Command.
    const commands = [].concat(args.command)
        .filter(Boolean)
        .map(command => {
            if (typeof command !== "string") {
                console.error("Invalid --command option")
                process.exit(1)
            }

            return (file) => {
                const env = Object.create(process.env, {FILE: {value: file}})
                const parts = parseShellQuote(command, env)
                const child = spawn(parts[0], parts.slice(1), {env})
                const outer = duplexer(child.stdin, child.stdout)
                child.on("exit", (code) => {
                    if (code !== 0) {
                        const error = new Error(
                            `non-zero exit code in command: ${command}`
                        )
                        outer.emit("error", error)
                    }
                })
                child.stderr.pipe(process.stderr)

                return outer
            }
        })

    // Resolve Transforms.
    const ABS_OR_REL = /^[./]/
    const transforms = [].concat(args.transform)
        .filter(Boolean)
        .map(arg => {
            if (typeof arg === "string") {
                return {name: arg, argv: null}
            }
            if (typeof arg._[0] === "string") {
                return {name: arg._.shift(), argv: arg}
            }

            console.error("Invalid --transform option")
            process.exit(1)
        })
        .map(item => {
            const createStream = (ABS_OR_REL.test(item.name) ?
                require(resolvePath(item.name)) :
                require(resolveModule(item.name, {basedir: process.cwd()}))
            )
            return (file) => createStream(file, item.argv)
        })

    // Merge commands and transforms as same as order of process.argv.
    const C_OR_COMMAND = /^(?:-c|--command)$/
    const T_OR_TRANSFORM = /^(?:-t|--transform)$/
    const mergedTransformFactories =
        process.argv
            .map(part => {
                if (C_OR_COMMAND.test(part)) {
                    return commands.shift()
                }
                if (T_OR_TRANSFORM.test(part)) {
                    return transforms.shift()
                }
                return null
            })
            .filter(Boolean)

    // Main.
    const cpx = new Cpx(
        source,
        outDir,
        {
            transform: mergedTransformFactories,
            dereference: args.dereference,
            includeEmptyDirs: args.includeEmptyDirs,
            initialCopy: args.initial,
            preserve: args.preserve,
            update: args.update,
        }
    )
    if (args.verbose) {
        cpx.on("copy", (event) => {
            console.log(`Copied: ${event.srcPath} --> ${event.dstPath}`)
        })
        cpx.on("remove", (event) => {
            console.log(`Removed: ${event.path}`)
        })
    }

    if (args.clean) {
        if (args.verbose) {
            console.log()
            console.log(`Clean: ${cpx.src2dst(cpx.source)}`)
            console.log()
        }
        try {
            cpx.cleanSync()
        }
        catch (err) {
            console.error(`Failed to clean: ${err.message}.`)
            process.exit(1)
        }
        if (args.verbose) {
            console.log()
            console.log(`Copy: ${source} --> ${outDir}`)
            console.log()
        }
    }

    if (args.watch) {
        if (args.verbose) {
            cpx.on("watch-ready", () => {
                console.log()
                console.log(`Be watching in ${cpx.base}`)
                console.log()
            })
        }
        cpx.on("watch-error", (err) => {
            console.error(err.message)
        })

        // In order to kill me by test harness on Windows.
        process.stdin.setEncoding("utf8")
        process.stdin.on("data", (chunk) => {
            if (chunk === "KILL") {
                process.exit(0)
            }
        })

        cpx.watch()
    }
    else {
        cpx.copy(err => {
            if (err) {
                console.error(`Failed to copy: ${err.message}.`)
                process.exit(1)
            }
        })
    }
}

/*eslint-enable no-process-exit, no-process-env */
