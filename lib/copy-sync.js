/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const fs = require("fs")
const Buffer = require("safe-buffer").Buffer
const mkdirSync = require("mkdirp").sync
const MAX_BUFFER = 2048

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

/**
 * @param {string} src - A path of the source file.
 * @param {string} dst - A path of the destination file.
 * @returns {void}
 * @private
 */
function copyBodySync(src, dst) {
    const buffer = Buffer.allocUnsafe(MAX_BUFFER)
    let bytesRead = MAX_BUFFER
    let pos = 0

    const input = fs.openSync(src, "r")
    try {
        const output = fs.openSync(dst, "w")
        try {
            while (MAX_BUFFER === bytesRead) {
                bytesRead = fs.readSync(input, buffer, 0, MAX_BUFFER, pos)
                fs.writeSync(output, buffer, 0, bytesRead)
                pos += bytesRead
            }
        }
        finally {
            fs.closeSync(output)
        }
    }
    finally {
        fs.closeSync(input)
    }
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

/**
 * @param {string} src - A path of the source file.
 * @param {string} dst - A path of the destination file.
 * @param {object} options - Options.
 * @param {boolean} options.preserve - The flag to copy attributes.
 * @param {boolean} options.update - The flag to disallow overwriting.
 * @returns {void}
 * @private
 */
module.exports = function copySync(src, dst, options) {
    const preserve = options.preserve
    const update = options.update
    const stat = fs.statSync(src)

    if (update) {
        try {
            const dstStat = fs.statSync(dst)
            if (dstStat.mtime.getTime() > stat.mtime.getTime()) {
                // Don't overwrite because the file on destination is newer than
                // the source file.
                return
            }
        }
        catch (_err) {
            // ignore - The file may not exist.
        }
    }

    if (stat.isDirectory()) {
        mkdirSync(dst)
    }
    else {
        copyBodySync(src, dst)
    }
    fs.chmodSync(dst, stat.mode)

    if (preserve) {
        fs.chownSync(dst, stat.uid, stat.gid)
        fs.utimesSync(dst, stat.atime, stat.mtime)
    }
}
