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
module.exports = function applyAction(pattern, options, action) {
    return new Promise((resolve, reject) => {
        let count = 0
        let done = false
        let lastError = null

        /**
         * Calls the callback function if done.
         * @returns {void}
         */
        function next() {
            if (done && count === 0) {
                if (lastError == null) {
                    resolve()
                } else {
                    reject(lastError)
                }
            }
        }

        const globOptions = {
            nodir: !options.includeEmptyDirs,
            silent: true,
            follow: Boolean(options.dereference),
            nosort: true,
        }
        try {
            new glob.Glob(pattern, globOptions)
                .on("match", sourcePath => {
                    if (lastError != null) {
                        return
                    }

                    count += 1
                    try {
                        action(sourcePath).then(
                            () => {
                                count -= 1
                                next()
                            },
                            error => {
                                count -= 1
                                lastError = lastError || error
                                next()
                            }
                        )
                    } catch (error) {
                        count -= 1
                        lastError = lastError || error
                        next()
                    }
                })
                .on("end", () => {
                    done = true
                    next()
                })
                .on("error", error => {
                    done = true
                    lastError = lastError || error
                    next()
                })
        } catch (error) {
            reject(error)
        }
    })
}
