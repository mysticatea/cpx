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
 * Remove a file or a directory asynchronously.
 * Additionally, remove the parent directory if it's empty.
 * @param {string} target The path to the target file.
 * @returns {void}
 * @private
 */
module.exports = async function removeFile(target) {
    let report = null
    try {
        const stat = await fs.stat(target)
        if (stat.isDirectory()) {
            await fs.rmdir(target)
        } else {
            await fs.unlink(target)
            report = target
        }
    } catch (err) {
        if (err.code !== "ENOENT") {
            throw err
        }
    }

    // Remove the parent directory if possible.
    try {
        await fs.rmdir(path.dirname(target))
    } catch (err) {
        if (err.code !== "ENOTEMPTY") {
            throw err
        }
    }

    return report
}
