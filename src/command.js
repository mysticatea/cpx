/*eslint no-process-exit:0*/
import {readFileSync} from "fs";
import {join as joinPath} from "path";
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

  -c, --clean     Clean files that matches <source> like pattern in <dest>
                  directory before the first copying.
  -h, --help      Print usage information
  -v, --verbose   Print copied/removed files.
  -V, --version   Print the version number
  -w, --watch     Watch for files that matches <source>, and copy the file to
                  <dest> every changing.
`;

const KNOWN_OPTIONS = new Set([
  "_",
  "c", "clean",
  "h", "help",
  "v", "verbose",
  "V", "version",
  "w", "watch"
]);

// Parse arguments.
const args = subarg(process.argv.slice(2), {
  boolean: ["clean", "help", "verbose", "version", "watch"],
  alias: {c: "clean", h: "help", v: "verbose", V: "version", w: "watch"}
});

// Validate Options.
{
  const unknowns = Object.keys(args).filter(key => !KNOWN_OPTIONS.has(key));
  if (unknowns.length > 0) {
    console.error(`Unknown option(s): ${unknowns.join(", ")}`);
    console.log(HELP_TEXT);
    process.exit(1);
  }
}

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

// Validate Arguments.
const source = args._[0];
const outDir = args._[1];
if (source == null || outDir == null || args.length > 2) {
  console.log(HELP_TEXT);
  process.exit(1);
}

//------------------------------------------------------------------------------
// Main.
let cpx = new Cpx(source, outDir);
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

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => {
    if (chunk === "KILL") {
      process.exit(0);
    }
  });

  cpx.watch();
}
else {
  try {
    cpx.copySync();
  }
  catch (err) {
    console.error(`Failed to copy: ${err.message}.`);
  }
}
