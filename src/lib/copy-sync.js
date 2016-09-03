/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */

"use strict"

const {Buffer} = require("safe-buffer")
const fs = require("fs")
const MAX_BUFFER = 2048

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

/**
 * @param {string} src - A path of the source file.
 * @param {string} dst - A path of the destination file.
 * @param {object} options - Options.
 * @param {boolean} options.preserve - The flag to copy attributes.
 * @returns {void}
 * @private
 */
module.exports = function copySync(src, dst, {preserve}) {
    const stat = fs.statSync(src)

    copyBodySync(src, dst)
    fs.chmodSync(dst, stat.mode)

    if (preserve) {
        fs.chownSync(dst, stat.uid, stat.gid)
        fs.utimesSync(dst, stat.atime, stat.mtime)
    }
}
