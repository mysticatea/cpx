/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const glob = require("glob")

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

/**
 * Apply the given action to every file which matches to the given pattern.
 *
 * @param {string} pattern - The pattern to find files.
 * @param {object} options - The option object.
 * @param {boolean} [options.includeEmptyDirs=false] - The flag to include empty directories to copy.
 * @param {boolean} [options.dereference=false] - The flag to dereference symbolic links.
 * @param {function(string):void} action - The action function to apply.
 * @returns {Promise<void>} The promise which will go fulfilled after done.
 * @private
 */
module.exports = function applyActionSync(pattern, options, action) {
    const globOptions = {
        nodir: !options.includeEmptyDirs,
        silent: true,
        follow: Boolean(options.dereference),
    }
    for (const sourcePath of glob.sync(pattern, globOptions)) {
        action(sourcePath)
    }
}
