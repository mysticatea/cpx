/**
 * @author Toru Nagashima
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const path = require("path")
const Minimatch = require("minimatch").Minimatch
const glob2base = require("glob2base")
const normalizePath = require("./normalize-path")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

/**
 * Get non-magic part of the given glob pattern.
 * @param {string} source The glob pattern to get base.
 * @returns {string} The non-magic part.
 * @private
 */
function getBasePath(source) {
    const minimatch = new Minimatch(source)
    return normalizePath(glob2base({ minimatch }))
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

/**
 * Normalize options.
 * @param {string} source The glob pattern of target files.
 * @param {string} outputDir The output directory.
 * @param {object} options The options.
 * @param {boolean} [options.clean=false] The flag to remove files which are on destination directory.
 * @param {boolean} [options.dereference=false] The flag to dereference symbolic links.
 * @param {boolean} [options.includeEmptyDirs=false] The flag to copy empty directories.
 * @param {boolean} [options.initialCopy=true] The flag to copy files at the first time.
 * @param {boolean} [options.preserve=false] The flag to copy file attributes such as timestamps, users, and groups.
 * @param {(function(string):stream.Transform)[]} [options.transform=null] The array of transform function's factories.
 * @param {boolean} [options.update=false] The flag to not overwrite newer files.
 * @returns {{baseDir:string,clean:boolean,dereference:boolean,includeEmptyDirs:boolean,initialCopy:boolean,outputDir:string,preserve:boolean,source:string,transform:any[],toDestination:any,update:boolean}} The normalized options.
 * @private
 */
module.exports = function normalizeOptions(source, outputDir, options) {
    const normalizedSource = normalizePath(source)
    const baseDir = getBasePath(normalizedSource)
    const normalizedOutputDir = normalizePath(outputDir)
    const toDestination =
        baseDir === "."
            ? sourcePath => path.join(normalizedOutputDir, sourcePath)
            : sourcePath => sourcePath.replace(baseDir, normalizedOutputDir)

    return {
        baseDir,
        clean: Boolean(options && options.clean),
        dereference: Boolean(options && options.dereference),
        includeEmptyDirs: Boolean(options && options.includeEmptyDirs),
        initialCopy: (options && options.initialCopy) !== false,
        outputDir,
        preserve: Boolean(options && options.preserve),
        source: normalizedSource,
        toDestination,
        transform: [].concat(options && options.transform).filter(Boolean),
        update: Boolean(options && options.update),
    }
}
