/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */

"use strict"

const {Buffer} = require("safe-buffer")
const {openSync, closeSync, readSync, writeSync} = require("fs")
const MAX_BUFFER = 2048

/**
 * @param {string} src - A path of the source file.
 * @param {string} dst - A path of the destination file.
 * @returns {void}
 * @private
 */
module.exports = function copySync(src, dst) {
    const buffer = Buffer.allocUnsafe(MAX_BUFFER)
    let bytesRead = MAX_BUFFER
    let pos = 0

    const input = openSync(src, "r")
    try {
        const output = openSync(dst, "w")
        try {
            while (MAX_BUFFER === bytesRead) {
                bytesRead = readSync(input, buffer, 0, MAX_BUFFER, pos)
                writeSync(output, buffer, 0, bytesRead)
                pos += bytesRead
            }
        }
        finally {
            closeSync(output)
        }
    }
    finally {
        closeSync(input)
    }
}
