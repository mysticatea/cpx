/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

/**
 * Prints the version text.
 *
 * @returns {void}
 */
module.exports = function version() {
    console.log(`v${require("../package.json").version}`)
}
