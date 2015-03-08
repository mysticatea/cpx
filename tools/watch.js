var exec = require("child_process").exec;
var babel = exec("babel src --out-dir lib --watch");
var mocha = exec("mocha test/*.js --compilers js:babel/register --timeout 5000 --watch --colors");

babel.stdout.pipe(process.stdout);
babel.stderr.pipe(process.stderr);
mocha.stdout.pipe(process.stdout);
mocha.stderr.pipe(process.stderr);
