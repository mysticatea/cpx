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
const fs = require("fs-extra")

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

/**
 * Remove a file or a directory synchronously.
 * Additionally, remove the parent directory if it's empty.
 * @param {string} target The path to the target file.
 * @returns {void}
 * @private
 */
module.exports = function removeFileSync(target) {
    try {
        const stat = fs.statSync(target)
        if (stat.isDirectory()) {
            fs.rmdirSync(target)
        } else {
            fs.unlinkSync(target)
        }
    } catch (err) {
        if (err.code !== "ENOENT") {
            throw err
        }
    }

    // Remove the parent directory if possible.
    try {
        fs.rmdirSync(path.dirname(target))
    } catch (err) {
        if (err.code !== "ENOTEMPTY") {
            throw err
        }
    }
}
