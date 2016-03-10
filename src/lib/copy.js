/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */

"use strict";

const {createReadStream, createWriteStream} = require("fs");

/**
 * @param {string} src - A path of the source file.
 * @param {string} dst - A path of the destination file.
 * @param {function[]} transformFactories - Factory functions for transform streams.
 * @param {function} cb - A callback function that called after copied.
 * @returns {void}
 * @private
 */
module.exports = function copy(src, dst, transformFactories, cb) {
    const reader = createReadStream(src);
    const writer = createWriteStream(dst);
    const streams = [reader];

    /**
     * Clean up.
     * @param {Error|undefined} err - An error or undefined.
     * @returns {void}
     */
    function done(err) {
        try {
            streams.forEach(s => {
                s.removeListener("error", done);
                s.destroy();
            });
            writer.removeListener("error", done);
            writer.removeListener("finish", done);
        }
        catch (cleanupErr) {
            cb(err || cleanupErr);
            return;
        }

        cb(err);
    }

    reader.on("error", done);
    writer.on("error", done);
    writer.on("finish", done);

    try {
        transformFactories
            .reduce((input, factory) => {
                const t = factory(src);
                t.on("error", done);
                streams.push(t);

                return input.pipe(t);
            }, reader)
            .pipe(writer);
    }
    catch (err) {
        done(err);
    }
};
