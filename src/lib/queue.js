/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */

"use strict"

// This require("power-assert") will be removed in the build script.
// eslint-disable-next-line node/no-unpublished-require
const assert = require("power-assert")
const TAIL = Symbol("tail")

/**
 * Dequeue jobs.
 *
 * @param {Queue} queue - A job queue instance.
 * @param {object} item - The current job item.
 * @returns {void}
 */
function dequeue(queue, item) {
    item.action(() => {
        if (item.next) {
            setImmediate(dequeue, queue, item.next)
        }
        else {
            assert(queue[TAIL] === item)
            queue[TAIL] = null
        }
    })
}

/**
 * Job Queue.
 *
 * @private
 */
module.exports = class Queue {
    /**
     * Constructor.
     */
    constructor() {
        this[TAIL] = null
    }

    /**
     * Adds a job item into this queue.
     *
     *     queue.push(done => {
     *         // do something.
     *         done();
     *     });
     *
     * @param {function} action - The action of new job.
     * @returns {void}
     */
    push(action) {
        assert(typeof action === "function")

        const item = {action, next: null}
        if (this[TAIL] != null) {
            this[TAIL] = this[TAIL].next = item
        }
        else {
            this[TAIL] = item
            setImmediate(dequeue, this, item)
        }
    }
}
