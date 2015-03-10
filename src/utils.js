export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertType(value, name, type) {
  if (typeof value !== type) {
    throw new TypeError(`${name} should be a ${type}.`);
  }
}

export function assertTypeOpt(value, name, type) {
  if (value != null && typeof value !== type) {
    throw new TypeError(`${name} should be a ${type} or null.`);
  }
}
