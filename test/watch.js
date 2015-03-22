import {exec} from "child_process";
import {expect} from "chai";
import * as cpx from "../lib/index";
import {setupTestDir,
        teardownTestDir,
        content,
        writeFile,
        removeFile} from "./util/util";

describe("The watch method", () => {
  let watcher, command;

  afterEach(done => {
    if (watcher) {
      watcher.close();
      watcher = null;
    }
    if (command) {
      command.stdin.write("KILL");
      command.on("exit", () => {
        teardownTestDir("test-ws");
        done();
      });
      command = null;
    }
    else {
      teardownTestDir("test-ws");
      done();
    }
  });

  function waitForReady(cb) {
    if (watcher) {
      watcher.on("watch-ready", function listener() {
        this.removeListener("watch-ready", listener);
        cb();
      });
    }
    else if (command) {
      command.stdout.on("data", function listener(chunk) {
        // Done the first copies.
        if (chunk.indexOf("Be watching in") >= 0) {
          this.removeListener("data", listener);
          cb();
        }
      });
    }
    else {
      cb();
    }
  }

  function waitForCopy(cb) {
    if (watcher) {
      watcher.on("copy", function listener() {
        this.removeListener("copy", listener);
        cb();
      });
    }
    else if (command) {
      command.stdout.on("data", function listener(chunk) {
        // Done the first copies.
        if (chunk.indexOf("Copied: ") >= 0) {
          this.removeListener("data", listener);
          cb();
        }
      });
    }
    else {
      cb();
    }
  }

  function waitForRemove(cb) {
    if (watcher) {
      watcher.on("remove", function listener() {
        this.removeListener("remove", listener);
        cb();
      });
    }
    else if (command) {
      command.stdout.on("data", function listener(chunk) {
        // Done the first copies.
        if (chunk.indexOf("Removed: ") >= 0) {
          this.removeListener("data", listener);
          cb();
        }
      });
    }
    else {
      cb();
    }
  }

  describe("should copy specified file blobs at first:", () => {
    beforeEach(() => {
      setupTestDir({
        "test-ws/untachable.txt": "untachable",
        "test-ws/a/hello.txt": "Hello",
        "test-ws/a/b/this-is.txt": "A pen",
        "test-ws/a/b/that-is.txt": "A note",
        "test-ws/a/b/no-copy.dat": "no-copy"
      });
    });

    function verifyFiles() {
      expect(content("test-ws/untachable.txt")).to.equal("untachable");
      expect(content("test-ws/a/hello.txt")).to.equal("Hello");
      expect(content("test-ws/a/b/this-is.txt")).to.equal("A pen");
      expect(content("test-ws/a/b/that-is.txt")).to.equal("A note");
      expect(content("test-ws/a/b/no-copy.dat")).to.equal("no-copy");
      expect(content("test-ws/b/untachable.txt")).to.be.null;
      expect(content("test-ws/b/hello.txt")).to.equal("Hello");
      expect(content("test-ws/b/b/this-is.txt")).to.equal("A pen");
      expect(content("test-ws/b/b/that-is.txt")).to.equal("A note");
      expect(content("test-ws/b/b/no-copy.dat")).to.be.null;
    }

    it("lib version.", done => {
      watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b");
      watcher.on("watch-ready", () => {
        // Done the first copies.
        verifyFiles();
        done();
      });
    });

    it("command version.", done => {
      command = exec("node lib/command.js \"test-ws/a/**/*.txt\" test-ws/b --watch --verbose");
      waitForReady(() => {
        verifyFiles();
        done();
      });
    });
  });

  describe("should clean and copy specified file blobs at first when give clean option:", () => {
    beforeEach(() => {
      setupTestDir({
        "test-ws/untachable.txt": "untachable",
        "test-ws/a/hello.txt": "Hello",
        "test-ws/a/b/this-is.txt": "A pen",
        "test-ws/a/b/that-is.txt": "A note",
        "test-ws/a/b/no-copy.dat": "no-copy",
        "test-ws/b/b/remove.txt": "remove",
        "test-ws/b/b/no-remove.dat": "no-remove"
      });
    });

    function verifyFiles() {
      expect(content("test-ws/untachable.txt")).to.equal("untachable");
      expect(content("test-ws/a/hello.txt")).to.equal("Hello");
      expect(content("test-ws/a/b/this-is.txt")).to.equal("A pen");
      expect(content("test-ws/a/b/that-is.txt")).to.equal("A note");
      expect(content("test-ws/a/b/no-copy.dat")).to.equal("no-copy");
      expect(content("test-ws/b/untachable.txt")).to.be.null;
      expect(content("test-ws/b/hello.txt")).to.equal("Hello");
      expect(content("test-ws/b/b/this-is.txt")).to.equal("A pen");
      expect(content("test-ws/b/b/that-is.txt")).to.equal("A note");
      expect(content("test-ws/b/b/no-copy.dat")).to.be.null;
      expect(content("test-ws/b/b/remove.txt")).to.be.null;
      expect(content("test-ws/b/b/no-remove.dat")).to.equal("no-remove");
    }

    it("lib version.", done => {
      watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b", {clean: true});
      waitForReady(() => {
        // Done the first copies.
        verifyFiles();
        done();
      });
    });

    it("command version.", done => {
      command = exec("node lib/command.js \"test-ws/a/**/*.txt\" test-ws/b --clean --watch --verbose");
      waitForReady(() => {
        verifyFiles();
        done();
      });
    });
  });

  [
    {
      description: "should copy on file added:",
      initialFiles: {
        "test-ws/a/hello.txt": "Hello"
      },
      action: () => {
        writeFile("test-ws/a/b/added.txt", "added");
      },
      verify: {
        "test-ws/b/hello.txt": "Hello",
        "test-ws/b/b/added.txt": "added"
      },
      wait: waitForCopy
    },
    {
      description: "should do nothing on file added if unmatch file globs:",
      initialFiles: {
        "test-ws/a/hello.txt": "Hello"
      },
      action: () => {
        writeFile("test-ws/a/b/not-added.dat", "added");
        // To fire copy event.
        writeFile("test-ws/a/a.txt", "a");
      },
      verify: {
        "test-ws/b/hello.txt": "Hello",
        "test-ws/b/b/not-added.dat": null
      },
      wait: waitForCopy
    },
    {
      description: "should copy on file changed:",
      initialFiles: {
        "test-ws/a/hello.txt": "Hello"
      },
      action: () => {
        writeFile("test-ws/a/hello.txt", "changed");
      },
      verify: {
        "test-ws/b/hello.txt": "changed"
      },
      wait: waitForCopy
    },
    {
      description: "should do nothing on file changed if unmatch file globs:",
      initialFiles: {
        "test-ws/a/hello.txt": "Hello",
        "test-ws/a/hello.dat": "Hello"
      },
      action: () => {
        writeFile("test-ws/a/hello.dat", "changed");
        // To fire copy event.
        writeFile("test-ws/a/a.txt", "a");
      },
      verify: {
        "test-ws/b/hello.txt": "Hello",
        "test-ws/b/hello.dat": null
      },
      wait: waitForCopy
    },
    {
      description: "should remove in the destination directory on file removed:",
      initialFiles: {
        "test-ws/a/hello.txt": "Hello"
      },
      action: () => {
        removeFile("test-ws/a/hello.txt");
      },
      verify: {
        "test-ws/b/hello.txt": null
      },
      wait: waitForRemove
    },
    {
      description: "should do nothing on file removed if unmatch file globs:",
      initialFiles: {
        "test-ws/a/hello.txt": "Hello",
        "test-ws/a/hello.dat": "Hello"
      },
      action: () => {
        removeFile("test-ws/a/hello.dat");
        // To fire copy event.
        writeFile("test-ws/a/a.txt", "a");
      },
      verify: {
        "test-ws/b/hello.txt": "Hello",
        "test-ws/b/hello.dat": null
      },
      wait: waitForCopy
    }
  ].forEach(item => {
    describe(item.description, () => {
      beforeEach(() => {
        setupTestDir(item.initialFiles);
      });

      function verifyFiles() {
        for (var file in item.verify) {
          expect(content(file)).to.equal(item.verify[file]);
        }
      }

      it("lib version.", done => {
        watcher = cpx.watch("test-ws/a/**/*.txt", "test-ws/b");
        waitForReady(() => {
          item.action();
          item.wait(() => {
            verifyFiles();
            done();
          });
        });
      });

      it("command version.", done => {
        command = exec("node lib/command.js \"test-ws/a/**/*.txt\" test-ws/b --watch --verbose");
        waitForReady(() => {
          item.action();
          item.wait(() => {
            verifyFiles();
            done();
          });
        });
      });
    });
  });

});
