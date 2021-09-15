/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const glob = require("glob-gitignore")
const pMap = require("p-map")

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
 * @param {string|Array.<string>} [options.ignore] - gitignore string or array of gitignore strings
 * @param {function(string):void} action - The action function to apply.
 * @returns {Promise<void>} The promise which will go fulfilled after done.
 * @private
 */
module.exports = async function applyAction(pattern, options, action) {
    const globOptions = {
        nodir: !options.includeEmptyDirs,
        silent: true,
        follow: Boolean(options.dereference),
        nosort: true,
        ignore: options.ignore,
    }
    const sourcePaths = await glob.glob(pattern, globOptions)

    return pMap(sourcePaths, action, { concurrency: 5 })
}
