/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const through = require("through")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

/**
 * Creates a transform stream to convert data to upper cases.
 * @returns {stream.Transform} A transform stream to convert data to upper cases.
 */
function toUpperCase() {
    return through(
        /* @this stream.Transform */ function write(chunk) {
            this.queue(chunk.toString().toUpperCase())
        },
        /* @this stream.Transform */ function end() {
            this.queue(null)
        }
    )
}

//------------------------------------------------------------------------------
// Main
//------------------------------------------------------------------------------

if (require.main === module) {
    process.stdin.pipe(toUpperCase()).pipe(process.stdout)
} else {
    module.exports = toUpperCase
}
