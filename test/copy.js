import {execSync} from "child_process";
import {expect} from "chai";
import * as cpx from "../lib/index";
import {setupTestDir,
        teardownTestDir,
        content} from "./util/util";
import upperify from "./util/upperify";

describe("The copy method", () => {

  describe("should copy specified file blobs:", () => {
    beforeEach(() => {
      setupTestDir({
        "test-ws/untachable.txt": "untachable",
        "test-ws/a/hello.txt": "Hello",
        "test-ws/a/b/this-is.txt": "A pen",
        "test-ws/a/b/that-is.txt": "A note",
        "test-ws/a/b/no-copy.dat": "no-copy"
      });
    });
    afterEach(() => {
      teardownTestDir("test-ws");
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

    it("lib async version.", done => {
      cpx.copy("test-ws/a/**/*.txt", "test-ws/b", err => {
        expect(err).to.be.null;
        verifyFiles();
        done();
      });
    });

    it("lib sync version.", () => {
      cpx.copySync("test-ws/a/**/*.txt", "test-ws/b");
      verifyFiles();
    });

    it("command version.", () => {
      execSync("node lib/command.js \"test-ws/a/**/*.txt\" test-ws/b");
      verifyFiles();
    });

  });

  describe("should clean and copy specified file blobs when give clean option:", () => {
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
    afterEach(() => {
      teardownTestDir("test-ws");
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

    it("lib async version.", done => {
      cpx.copy("test-ws/a/**/*.txt", "test-ws/b", {clean: true}, err => {
        expect(err).to.be.null;
        verifyFiles();
        done();
      });
    });

    it("lib sync version.", () => {
      cpx.copySync("test-ws/a/**/*.txt", "test-ws/b", {clean: true});
      verifyFiles();
    });

    it("command version.", () => {
      execSync("node lib/command.js \"test-ws/a/**/*.txt\" test-ws/b --clean");
      verifyFiles();
    });

  });

  describe("should copy with transform if specified command option.", () => {
    beforeEach(() => {
      setupTestDir({
        "test-ws/a/hello.txt": "Hello"
      });
    });
    afterEach(() => {
      teardownTestDir("test-ws");
    });

    function verifyFiles() {
      expect(content("test-ws/b/hello.txt")).to.equal("HELLO");
    }

    it("command version.", () => {
      execSync("node lib/command.js \"test-ws/a/**/*.txt\" test-ws/b --command \"node ./test/util/upperify.js\"");
      verifyFiles();
    });

  });

  describe("should copy with transform if specified transform option.", () => {
    beforeEach(() => {
      setupTestDir({
        "test-ws/a/hello.txt": "Hello"
      });
    });
    afterEach(() => {
      teardownTestDir("test-ws");
    });

    function verifyFiles() {
      expect(content("test-ws/b/hello.txt")).to.equal("HELLO");
    }

    it("lib async version.", done => {
      cpx.copy("test-ws/a/**/*.txt", "test-ws/b", {transform: upperify}, err => {
        expect(err).to.be.null;
        verifyFiles();
        done();
      });
    });

    it("should throw an error on lib sync version (cannot use streaming api).", () => {
      expect(() => {
        cpx.copySync("test-ws/a/**/*.txt", "test-ws/b", {transform: upperify});
      }).to.throw(Error);
    });

    it("command version.", () => {
      execSync("node lib/command.js \"test-ws/a/**/*.txt\" test-ws/b --transform ./test/util/upperify");
      verifyFiles();
    });

  });

  describe("should keep order even if -c and -t are mixed.", () => {
    beforeEach(() => {
      setupTestDir({
        "test-ws/a/hello.txt": "Hello"
      });
    });
    afterEach(() => {
      teardownTestDir("test-ws");
    });

    function verifyFiles() {
      expect(content("test-ws/b/hello.txt")).to.equal("Helloabcd");
    }

    it("command version.", () => {
      execSync("node lib/command.js \"test-ws/a/**/*.txt\" test-ws/b -c \"node ./test/util/appendify.js a\" -t [./test/util/appendify b] -c \"node ./test/util/appendify.js c\" -t [./test/util/appendify d]");
      verifyFiles();
    });

  });

});
