/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

/**
 * Prints the help text.
 *
 * @returns {void}
 */
module.exports = function help() {
    console.log(`
Usage: cpx <source> <dest> [options]

    cpx2: Copy files, watching for changes.

        <source>  The glob of target files.
        <dest>    The path of a destination directory.

Options:

    -c, --command <command>   A command text to transform each file.
    -C, --clean               Clean files that matches <source> like pattern in
                              <dest> directory before the first copying.
    -L, --dereference         Follow symbolic links when copying from them.
    -h, --help                Print usage information.
    --include-empty-dirs      The flag to copy empty directories which is
                              matched with the glob.
    --no-initial              The flag to not copy at the initial time of watch.
                              Use together '--watch' option.
    -p, --preserve            The flag to copy attributes of files.
                              This attributes are uid, gid, atime, and mtime.
    -t, --transform <name>    A module name to transform each file. cpx lookups
                                the specified name via "require()".
    -u, --update              The flag to not overwrite files on destination if
                              the source file is older.
    -v, --verbose             Print copied/removed files.
    -V, --version             Print the version number.
    -w, --watch               Watch for files that matches <source>, and copy
                              the file to <dest> every changing.

Examples:

    cpx "src/**/*.{html,png,jpg}" app
    cpx "src/**/*.css" app --watch --verbose

See Also:
    https://github.com/bcomnes/cpx2

Thanks To:
    https://github.com/mysticatea/cpx  Maybe one day we can upstream this maintenance work.
`)
}
