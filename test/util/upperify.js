var through = require("through");

module.exports = function toUpperCase() {
  var buffer = null;
  return through(
    function write(data) {
      if (typeof data === "string") {
        data = new Buffer(data);
      }
      if (buffer == null) {
        buffer = data;
      }
      else {
        buffer = Buffer.concat(buffer, data);
      }
    },
    function end() {
      this.queue(buffer == null ? "" : buffer.toString().toUpperCase());
      this.queue(null);
    }
  );
};
