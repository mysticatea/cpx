import {assert, assertType} from "./utils";

const TAIL = Symbol("tail");

function dequeue(queue, item) {
  item.action(() => {
    if (item.next) {
      setImmediate(dequeue, queue, item.next);
    }
    else {
      assert(queue[TAIL] === item);
      queue[TAIL] = null;
    }
  });
}

export default class Queue {
  constructor() {
    this[TAIL] = null;
  }

  push(action) {
    assertType(action, "action", "function");

    let item = {action, next: null};
    if (this[TAIL] != null) {
      this[TAIL].next = item;
      this[TAIL] = item;
    }
    else {
      this[TAIL] = item;
      setImmediate(dequeue, this, item);
    }
  }
}
