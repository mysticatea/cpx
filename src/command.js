/*eslint no-process-exit:0*/
import {Command} from "commander";
import Cpx from "./cpx";

// Define command.
const command =
  new Command("cpx")
    .version("1.0.0")
    .usage("<source> <dest> [options]")
    .description(`
copy file globs, watching for changes.

  <source>: target file globs.
            e.g. src/**/*.{html,png,jpg}
  <dest>:   a path of destination directory.
            e.g. app
`.trim())
    .option("--clean", "clean files that matches <source> pattern in <dest> directory before copying.")
    .option("-w, --watch", "watch for files that matches <source> pattern, then copy to <dest> on changed.")
    .option("-v, --verbose", "print copied/removed files.")
    .parse(process.argv);

// Get arguments.
const source = command.args[0];
const outDir = command.args[1];
const shouldClean = Boolean(command.clean);
const isWatchMode = Boolean(command.watch);
const verbose = Boolean(command.verbose);

// Validate.
if (source == null || outDir == null || command.args.length > 2) {
  command.outputHelp();
  process.exit(1);
}

// Main.
let cpx = new Cpx(source, outDir);
if (verbose) {
  cpx.on("copy", e => {
    console.log(`Copied: ${e.srcPath} --> ${e.dstPath}`);
  });
  cpx.on("remove", e => {
    console.log(`Removed: ${e.path}`);
  });
}

if (shouldClean) {
  if (verbose) {
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
  if (verbose) {
    console.log();
    console.log(`Copy: ${source} --> ${outDir}`);
    console.log();
  }
}

if (isWatchMode) {
  if (verbose) {
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
