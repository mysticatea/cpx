/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const path = require("path")
const co = require("co")
const fs = require("fs-extra")

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

/**
 * Remove a file or a directory asynchronously.
 * Additionally, remove the parent directory if it's empty.
 * @param {string} target The path to the target file.
 * @returns {void}
 * @private
 */
module.exports = co.wrap(function* removeFile(target) {
    try {
        const stat = yield fs.stat(target)
        if (stat.isDirectory()) {
            yield fs.rmdir(target)
        } else {
            yield fs.unlink(target)
        }
    } catch (err) {
        if (err.code !== "ENOENT") {
            throw err
        }
    }

    // Remove the parent directory if possible.
    try {
        yield fs.rmdir(path.dirname(target))
    } catch (err) {
        if (err.code !== "ENOTEMPTY") {
            throw err
        }
    }
})
