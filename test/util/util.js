/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const assert = require("assert")
const exec = require("child_process").exec
const dirname = require("path").dirname
const co = require("co")
const fs = require("fs-extra")
const execSync = require("shelljs").exec

//------------------------------------------------------------------------------
// Public Interface
//------------------------------------------------------------------------------

/**
 * Wait for the given duration.
 *
 * @param {number} ms The duration in milliseconds to wait.
 * @returns {Promise<void>} The promise which will go fulfilled after the duration.
 */
const delay = module.exports.delay = function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Writes specific data to a specific file.
 *
 * @param {string} path - A path to write.
 * @param {string} contentText - A text to write.
 * @returns {Promise<void>} The promise which will go fulfilled after done.
 */
const writeFile = module.exports.writeFile = co.wrap(function* writeFile(path, contentText) {
    yield fs.ensureDir(dirname(path))
    yield fs.writeFile(path, contentText)
})

/**
 * Removes a specific file.
 *
 * @param {string} path - A path to write.
 * @returns {Promise<void>} The promise which will go fulfilled after done.
 */
module.exports.removeFile = function removeFile(path) {
    return fs.remove(path)
}

/**
 * Gets the content of a specific file.
 *
 * @param {string} path - A path to read.
 * @returns {Promise<string|null>} The content of the file, or `null` if not found.
 */
const readFile = module.exports.content = function content(path) {
    return fs.readFile(path, {encoding: "utf8"}).catch(() => null)
}

/**
 * Sets up test files.
 *
 * @param {object} dataset - Test data to write.
 * @returns {Promise<void>} The promise which will go fulfilled after done.
 */
module.exports.setupTestDir = function setupTestDir(dataset) {
    return Promise.all(
        Object.keys(dataset).map(path =>
            (dataset[path] == null)
                ? fs.ensureDir(path)
                : writeFile(path, dataset[path])
        )
    ).then(() => delay(250))
}

/**
 * Removes test data.
 *
 * @param {string} testRootPath - A path to write.
 * @returns {Promise<void>} The promise which will go fulfilled after done.
 */
module.exports.teardownTestDir = function teardownTestDir(testRootPath) {
    return fs.remove(testRootPath)
}

/**
 * Sets up test files.
 *
 * @param {object} dataset - Test data to write.
 * @returns {Promise<void>} The promise which will go fulfilled after done.
 */
module.exports.verifyTestDir = co.wrap(function* verifyTestDir(dataset) {
    for (const path of Object.keys(dataset)) {
        const content = yield readFile(path)
        assert.equal(content, dataset[path])
    }
})

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
