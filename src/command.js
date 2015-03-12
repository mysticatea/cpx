/*eslint no-process-exit:0*/
import {readFileSync} from "fs";
import {join as joinPath,
        resolve as resolvePath} from "path";
import {sync as resolveModule} from "resolve";
import subarg from "subarg";
import Cpx from "./cpx";

const HELP_TEXT = `
Usage: cpx <source> <dest> [options]

  Copy file globs, watching for changes.

    <source>  A file glob of target files.
              e.g. src/**/*.{html,png,jpg}
    <dest>    A path of destination directory.
              e.g. app

Options:

  -c, --clean       Clean files that matches <source> like pattern in <dest>
                    directory before the first copying.
  -h, --help        Print usage information
  -t, --transform   A transform module name. cpx lookups the specified name via
                    "require()". You can give "-t" multiple.
  -v, --verbose     Print copied/removed files.
  -V, --version     Print the version number
  -w, --watch       Watch for files that matches <source>, and copy the file to
                    <dest> every changing.

See Also:
  https://github.com/mysticatea/cpx
`;

// {Shorname: Fullname}
const OPTIONS = {
  "c": "clean",
  "h": "help",
  "t": "transform",
  "v": "verbose",
  "V": "version",
  "w": "watch"
};

//------------------------------------------------------------------------------
// Parse arguments.
const args = subarg(process.argv.slice(2), {
  boolean: ["clean", "help", "verbose", "version", "watch"],
  alias: OPTIONS
});

//------------------------------------------------------------------------------
// Validate Options.
const knowns = new Set(["_"]);
for (let key in OPTIONS) {
  knowns.add(key);
  knowns.add(OPTIONS[key]);
}
const unknowns = Object.keys(args).filter(key => !knowns.has(key));
if (unknowns.length > 0) {
  console.error(`Unknown option(s): ${unknowns.join(", ")}`);
  console.log(HELP_TEXT);
  process.exit(1);
}

//------------------------------------------------------------------------------
// Help/Version.
if (args.help) {
  console.log(HELP_TEXT);
  process.exit(0);
}
if (args.version) {
  console.log(
    JSON.parse(readFileSync(joinPath(__dirname, "../package.json"))).version);
  process.exit(0);
}

//------------------------------------------------------------------------------
// Validate Arguments.
const source = args._[0];
const outDir = args._[1];
if (source == null || outDir == null || args.length > 2) {
  console.log(HELP_TEXT);
  process.exit(1);
}

//------------------------------------------------------------------------------
// Resolve Transforms.
const ABS_OR_REL = /^[.\/]/;
const transform =
  [].concat(args.transform)
    .filter(Boolean)
    .map(arg => {
      if (typeof arg === "string") {
        return {name: arg, argv: null};
      }
      if (typeof arg._[0] === "string") {
        return {name: arg._.shift(), argv: arg};
      }
      console.error("Invalid --transform option");
      process.exit(1);
    })
    .map(item => {
        const createStream = (ABS_OR_REL.test(item.name) ?
          require(resolvePath(item.name)) :
          require(resolveModule(item.name, {basedir: process.cwd()}))
        );
        return file => createStream(file, item.argv);
    });

//------------------------------------------------------------------------------
// Main.
const cpx = new Cpx(source, outDir, {transform});
if (args.verbose) {
  cpx.on("copy", e => {
    console.log(`Copied: ${e.srcPath} --> ${e.dstPath}`);
  });
  cpx.on("remove", e => {
    console.log(`Removed: ${e.path}`);
  });
}

if (args.clean) {
  if (args.verbose) {
    console.log();
    console.log(`Clean: ${cpx.dest}`);
    console.log();
  }
  try {
    cpx.cleanSync();
  }
  catch (err) {
    console.error(`Failed to clean: ${err.message}.`);
    process.exit(1);
  }
  if (args.verbose) {
    console.log();
    console.log(`Copy: ${source} --> ${outDir}`);
    console.log();
  }
}

if (args.watch) {
  if (args.verbose) {
    cpx.on("watch-ready", () => {
      console.log();
      console.log(`Be watching in ${cpx.base}`);
      console.log();
    });
  }
  cpx.on("watch-error", err => {
    console.error(err.message);
  });

  // In order to kill me by test harness on Windows.
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => {
    if (chunk === "KILL") {
      process.exit(0);
    }
  });

  cpx.watch();
}
else {
  cpx.copy(err => {
    if (err) {
      console.error(`Failed to copy: ${err.message}.`);
      process.exit(1);
    }
  });
}
