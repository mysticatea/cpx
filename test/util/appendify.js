/*eslint no-process-exit:0*/
var through = require("through");

var postfix = process.argv[2] || "";

var appenda = module.exports = function appenda(filename, args) {
  var buffer = new Buffer(0);
  return through(
    function write(data) {
      if (typeof data === "string") {
        data = new Buffer(data);
      }
      buffer = Buffer.concat([buffer, data]);
    },
    function end() {
      if (buffer.length > 0) {
        this.queue(buffer.toString());
      }

      var value = (args && args._ && args._[0]) || postfix || "";
      if (value) {
        this.queue(value);
      }
      this.queue(null);
    }
  );
};

if (require.main === module) {
  process.stdin.pipe(appenda()).pipe(process.stdout);
}
