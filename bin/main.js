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
const applyAction = require("../lib/utils/apply-action")
const applyActionSync = require("../lib/utils/apply-action-sync")
const copyFile = require("../lib/utils/copy-file")
const normalizeOptions = require("../lib/utils/normalize-options")
const removeFileSync = require("../lib/utils/remove-file-sync")
const Watcher = require("../lib/utils/watcher")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const ABS_OR_REL = /^[./]/u
const C_OR_COMMAND = /^(?:-c|--command)$/u
const T_OR_TRANSFORM = /^(?:-t|--transform)$/u

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

module.exports = function main(source, outDir, args) {
    // Resolve Command.
    const commands = []
        .concat(args.command)
        .filter(Boolean)
        .map(command => {
            if (typeof command !== "string") {
                console.error("Invalid --command option")
                process.exit(1)
            }

            return file => {
                const env = Object.create(process.env, {
                    FILE: { value: file },
                })
                const parts = parseShellQuote(command, env)
                const child = spawn(parts[0], parts.slice(1), { env })
                const outer = duplexer(child.stdin, child.stdout)
                child.on("exit", code => {
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
    const transforms = []
        .concat(args.transform)
        .filter(Boolean)
        .map(arg => {
            if (typeof arg === "string") {
                return { name: arg, argv: null }
            }
            if (typeof arg._[0] === "string") {
                return { name: arg._.shift(), argv: arg }
            }

            console.error("Invalid --transform option")
            process.exit(1)
        })
        .map(item => {
            const createStream = ABS_OR_REL.test(item.name)
                ? require(resolvePath(item.name))
                : require(resolveModule(item.name, { basedir: process.cwd() }))
            return (file, opts) =>
                createStream(file, Object.assign({ _flags: opts }, item.argv))
        })

    // Merge commands and transforms as same as order of process.argv.
    const mergedTransformFactories = process.argv
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
    const log = args.verbose
        ? console.log.bind(console)
        : () => {
              /* do nothing */
          }
    const options = normalizeOptions(source, outDir, {
        transform: mergedTransformFactories,
        dereference: args.dereference,
        includeEmptyDirs: args.includeEmptyDirs,
        initialCopy: args.initial,
        preserve: args.preserve,
        update: args.update,
    })

    if (args.clean) {
        const output = options.toDestination(options.source)
        if (output !== options.source) {
            log()
            log(`Clean: ${output}`)
            log()
            try {
                applyActionSync(output, options, targetPath => {
                    removeFileSync(targetPath)
                    log(`Removed: ${targetPath}`)
                })
            } catch (err) {
                console.error(`Failed to clean: ${err.message}.`)
                process.exit(1)
            }
        }
    }

    if (args.watch) {
        if (options.initialCopy) {
            log()
            log(`Copy: ${source} --> ${outDir}`)
            log()
        }

        new Watcher(options)
            .on("copy", event => {
                log(`Copied: ${event.srcPath} --> ${event.dstPath}`)
            })
            .on("remove", event => {
                log(`Removed: ${event.path}`)
            })
            .on("watch-ready", () => {
                log()
                log(`Be watching ${options.source}`)
                log()
            })
            .on("watch-error", err => {
                console.error(err.message)
            })
            .open()
    } else {
        log()
        log(`Copy: ${source} --> ${outDir}`)
        log()

        applyAction(options.source, options, sourcePath => {
            const outputPath = options.toDestination(sourcePath)
            if (outputPath !== sourcePath) {
                return copyFile(sourcePath, outputPath, options).then(() => {
                    log(`Copied: ${sourcePath} --> ${outputPath}`)
                })
            }
            return Promise.resolve()
        }).catch(error => {
            console.error(`Failed to copy: ${error.message}.`)
            process.exit(1)
        })
    }
}

/*eslint-enable no-process-exit, no-process-env */
