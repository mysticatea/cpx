/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

const fs = require("fs")
const mkdir = require("mkdirp")
const Queue = require("./queue")

/**
 * @param {string} src - A path of the source file.
 * @param {string} dst - A path of the destination file.
 * @param {function[]} transformFactories - Factory functions for transform streams.
 * @param {function} cb - A callback function that called after copied.
 * @returns {void}
 * @private
 */
function copyBody(src, dst, transformFactories, cb) {
    const reader = fs.createReadStream(src)
    const writer = fs.createWriteStream(dst)
    const streams = [reader]

    /**
     * Clean up.
     * @param {Error|undefined} err - An error or undefined.
     * @returns {void}
     */
    function next(err) {
        try {
            for (const s of streams) {
                s.removeListener("error", next)
                if (typeof s.destroy === "function") {
                    s.destroy()
                }
            }
            writer.removeListener("error", next)
            writer.removeListener("finish", next)
        }
        catch (cleanupErr) {
            cb(err || cleanupErr)
            return
        }

        cb(err)
    }

    reader.on("error", next)
    writer.on("error", next)
    writer.on("finish", next)

    try {
        transformFactories
            .reduce((input, factory) => {
                const t = factory(src)
                t.on("error", next)
                streams.push(t)

                return input.pipe(t)
            }, reader)
            .pipe(writer)
    }
    catch (err) {
        next(err)
    }
}

/**
 * @param {string} src - A path of the source file.
 * @param {string} dst - A path of the destination file.
 * @param {object} options - Options.
 * @param {function[]} options.transformFactories - Factory functions for transform streams.
 * @param {boolean} options.preserve - The flag to copy attributes.
 * @param {boolean} options.update - The flag to disallow overwriting.
 * @param {function} cb - A callback function that called after copied.
 * @returns {void}
 * @private
 */
module.exports = function copy(src, dst, options, cb) {
    const transformFactories = options.transformFactories
    const preserve = options.preserve
    const update = options.update
    const q = new Queue()
    let stat = null

    q.push(next => fs.stat(src, (err, result) => {
        if (err) {
            cb(err)
        }
        else {
            stat = result
            next()
        }
    }))
    if (update) {
        q.push(next => fs.stat(dst, (err, dstStat) => {
            if (!err && dstStat.mtime.getTime() > stat.mtime.getTime()) {
                // Don't overwrite because the file on destination is newer than
                // the source file.
                cb(null)
            }
            else {
                next()
            }
        }))
    }

    q.push(next => {
        if (stat.isDirectory()) {
            mkdir(dst, (err) => {
                if (err) {
                    cb(err)
                }
                else {
                    next()
                }
            })
        }
        else {
            copyBody(src, dst, transformFactories, (err) => {
                if (err) {
                    cb(err)
                }
                else {
                    next()
                }
            })
        }
    })
    q.push(next => fs.chmod(dst, stat.mode, (err) => {
        if (err) {
            cb(err)
        }
        else {
            next()
        }
    }))

    if (preserve) {
        q.push(next => fs.chown(dst, stat.uid, stat.gid, (err) => {
            if (err) {
                cb(err)
            }
            else {
                next()
            }
        }))
        q.push(next => fs.utimes(dst, stat.atime, stat.mtime, (err) => {
            if (err) {
                cb(err)
            }
            else {
                next()
            }
        }))
    }

    q.push(next => {
        next()
        cb(null)
    })
}
