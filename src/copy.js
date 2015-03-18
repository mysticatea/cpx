import {createReadStream,
        createWriteStream,
        openSync,
        closeSync,
        readSync,
        writeSync} from "fs";

const MAX_BUFFER = 2048;

/**
 * @param {string} src - A path of the source file.
 * @param {string} dst - A path of the destination file.
 * @param {function[]} transformFactories - Factory functions for transform streams.
 * @param {function} cb - A callback function that called after copied.
 * @private
 */
export function copy(src, dst, transformFactories, cb) {
  const reader = createReadStream(src);
  const writer = createWriteStream(dst);
  const streams = [reader];

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
      err = err || cleanupErr;
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
}

/**
 * @param {string} src - A path of the source file.
 * @param {string} dst - A path of the destination file.
 * @private
 */
export function copySync(src, dst) {
  const buffer = new Buffer(MAX_BUFFER);
  let bytesRead = MAX_BUFFER;
  let pos = 0;
  const input = openSync(src, "r");
  try {
    const output = openSync(dst, "w");
    try {
      while (MAX_BUFFER === bytesRead) {
        bytesRead = readSync(input, buffer, 0, MAX_BUFFER, pos);
        writeSync(output, buffer, 0, bytesRead);
        pos += bytesRead;
      }
    }
    finally {
      closeSync(output);
    }
  }
  finally {
    closeSync(input);
  }
}
