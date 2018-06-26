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
const normalizeOptions = require("./utils/normalize-options")
const applyActionSync = require("./utils/apply-action-sync")
const copyFileSync = require("./utils/copy-file-sync")
const removeFileSync = require("./utils/remove-file-sync")

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

/**
 * Copy files synchronously.
 * @param {string} source The glob pattern of target files.
 * @param {string} outputDir The output directory.
 * @param {object} [options] The options.
 * @param {boolean} [options.clean=false] The flag to remove files which are on destination directory.
 * @param {boolean} [options.dereference=false] The flag to dereference symbolic links.
 * @param {boolean} [options.includeEmptyDirs=false] The flag to copy empty directories.
 * @param {boolean} [options.initialCopy=true] The flag to copy files at the first time.
 * @param {boolean} [options.preserve=false] The flag to copy file attributes such as timestamps, users, and groups.
 * @param {boolean} [options.update=false] The flag to not overwrite newer files.
 * @returns {void}
 */
module.exports = function copySync(source, outputDir, options) {
    assert(typeof source === "string", "'source' should be a string.")
    assert(source.trim().length >= 1, "'source' should not be empty.")
    assert(typeof outputDir === "string", "'outputDir' should be a string.")
    assert(outputDir.trim().length >= 1, "'outputDir' should not be empty.")
    if (typeof options === "object" && options !== null) {
        assert(
            options.transform === undefined,
            "'options.transform' is not supported in synchronous functions."
        )
    }

    options = normalizeOptions(source, outputDir, options) //eslint-disable-line no-param-reassign

    // Clean
    if (options.clean) {
        const output = options.toDestination(options.source)
        if (output !== options.source) {
            applyActionSync(output, options, targetPath => {
                removeFileSync(targetPath)
            })
        }
    }

    // Copy
    applyActionSync(options.source, options, sourcePath => {
        const outputPath = options.toDestination(sourcePath)
        if (outputPath !== sourcePath) {
            copyFileSync(sourcePath, outputPath, options)
        }
    })
}
