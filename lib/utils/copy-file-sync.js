/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const path = require("path")
const fs = require("fs-extra")

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

/**
 * Copy a file synchronously.
 * Additionally, copy file attributes also by options.
 * @param {string} source - A path of the source file.
 * @param {string} output - A path of the destination file.
 * @param {object} options - Options.
 * @param {boolean} options.preserve - The flag to copy attributes.
 * @param {boolean} options.update - The flag to disallow overwriting.
 * @returns {void}
 * @private
 */
module.exports = function copyFileSync(source, output, options) {
    const stat = fs.statSync(source)

    if (options.update) {
        try {
            const dstStat = fs.statSync(output)
            if (dstStat.mtime.getTime() > stat.mtime.getTime()) {
                // Don't overwrite because the file on destination is newer than
                // the source file.
                return
            }
        } catch (_err) {
            // ignore - The file may not exist.
        }
    }

    if (stat.isDirectory()) {
        fs.ensureDirSync(output)
    } else {
        fs.ensureDirSync(path.dirname(output))
        fs.copySync(source, output)
    }
    fs.chmodSync(output, stat.mode)

    if (options.preserve) {
        fs.chownSync(output, stat.uid, stat.gid)
        fs.utimesSync(output, stat.atime, stat.mtime)
    }
}
