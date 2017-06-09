/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const exec = require("child_process").exec
const dirname = require("path").dirname
const fs = require("fs-extra")
const execSync = require("shelljs").exec

//------------------------------------------------------------------------------
// Public Interface
//------------------------------------------------------------------------------

/**
 * Writes specific data to a specific file.
 *
 * @param {string} path - A path to write.
 * @param {string} contentText - A text to write.
 * @returns {void}
 */
const writeFile = module.exports.writeFile = function writeFile(path, contentText) {
    fs.ensureDirSync(dirname(path))
    fs.writeFileSync(path, contentText)
}

/**
 * Removes a specific file.
 *
 * @param {string} path - A path to write.
 * @returns {void}
 */
module.exports.removeFile = function removeFile(path) {
    fs.removeSync(path)
}

/**
 * Sets up test files.
 *
 * @param {object} dataset - Test data to write.
 * @returns {void}
 */
module.exports.setupTestDir = function setupTestDir(dataset) {
    for (const path of Object.keys(dataset)) {
        if (dataset[path] == null) {
            fs.ensureDirSync(path)
        }
        else {
            writeFile(path, dataset[path])
        }
    }
}

/**
 * Removes test data.
 *
 * @param {string} testRootPath - A path to write.
 * @returns {void}
 */
module.exports.teardownTestDir = function teardownTestDir(testRootPath) {
    fs.removeSync(testRootPath)
}

/**
 * Gets the content of a specific file.
 *
 * @param {string} path - A path to read.
 * @returns {string|null} The content of the file, or `null` if not found.
 */
module.exports.content = function content(path) {
    try {
        return fs.readFileSync(path, {encoding: "utf8"})
    }
    catch (_err) {
        return null
    }
}

/**
 * Execute cpx command.
 * @param {string} args - Command arguments.
 * @returns {child_process.ChildProcess} A child process object.
 */
module.exports.execCommand = function execCommand(args) {
    return exec(`node test/util/bin.js ${args}`)
}

/**
 * Execute cpx command.
 * @param {string} args - Command arguments.
 * @returns {void}
 */
module.exports.execCommandSync = function execCommandSync(args) {
    return execSync(`node test/util/bin.js ${args}`, {silent: true})
}
