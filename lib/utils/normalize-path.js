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

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

/**
 * Convert the given file path to use glob.
 * Glob doesn't support the delimiter of Windows.
 *
 * @param {string} originalPath - The path to convert.
 * @returns {string} The normalized path.
 * @private
 */
module.exports = function normalizePath(originalPath) {
    if (originalPath == null) {
        return null
    }

    const relativePath = path.resolve(originalPath)
    const normalizedPath = relativePath.replace(/\\/g, "/")

    if (/\/$/.test(normalizedPath)) {
        return normalizedPath.slice(0, -1)
    }
    return normalizedPath || "."
}
