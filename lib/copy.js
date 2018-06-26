/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const assert = require("assert")
const co = require("co")
const normalizeOptions = require("./utils/normalize-options")
const applyAction = require("./utils/apply-action")
const copyFile = require("./utils/copy-file")
const removeFile = require("./utils/remove-file")

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

/**
 * Copy files asynchronously.
 * @param {string} source The glob pattern of target files.
 * @param {string} outputDir The output directory.
 * @param {object} [options] The options.
 * @param {boolean} [options.clean=false] The flag to remove files which are on destination directory.
 * @param {boolean} [options.dereference=false] The flag to dereference symbolic links.
 * @param {boolean} [options.includeEmptyDirs=false] The flag to copy empty directories.
 * @param {boolean} [options.initialCopy=true] The flag to copy files at the first time.
 * @param {boolean} [options.preserve=false] The flag to copy file attributes such as timestamps, users, and groups.
 * @param {(function(string):void)[]} [options.transform] The array of the factories of transform streams.
 * @param {boolean} [options.update=false] The flag to not overwrite newer files.
 * @param {function(Error):void} [callback] The callback function which will go fulfilled after done.
 * @returns {Promise<void>} The promise which will go fulfilled after done.
 */
module.exports = function copy(source, outputDir, options, callback) {
    /*eslint-disable no-param-reassign */
    if (typeof options === "function") {
        callback = options
        options = undefined
    }
    /*eslint-enable no-param-reassign */

    const promise = co(function*() {
        assert(typeof source === "string", "'source' should be a string.")
        assert(source.trim().length >= 1, "'source' should not be empty.")
        assert(typeof outputDir === "string", "'outputDir' should be a string.")
        assert(outputDir.trim().length >= 1, "'outputDir' should not be empty.")
        if (options != null) {
            assert(
                typeof options === "object",
                "'options' should be an object."
            )
        }
        if (callback != null) {
            assert(
                typeof callback === "function",
                "'callback' should be a function."
            )
        }

        //eslint-disable-next-line no-param-reassign
        options = normalizeOptions(source, outputDir, options)

        // Clean
        if (options.clean) {
            const output = options.toDestination(options.source)
            if (output !== options.source) {
                yield applyAction(output, options, targetPath =>
                    removeFile(targetPath)
                )
            }
        }

        // Copy
        yield applyAction(options.source, options, sourcePath => {
            const outputPath = options.toDestination(sourcePath)
            if (outputPath !== sourcePath) {
                return copyFile(sourcePath, outputPath, options)
            }
            return Promise.resolve()
        })
    })

    if (callback != null) {
        promise.then(() => callback(null), callback)
    }

    return promise
}
