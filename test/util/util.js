import {dirname} from "path";
import {readFileSync, writeFileSync} from "fs";
import {sync as mkdir} from "mkdirp";
import {sync as rimraf} from "rimraf";

export function setupTestDir(dataset) {
  for (let path in dataset) {
    writeFile(path, dataset[path]);
  }
};

export function teardownTestDir(testRootPath) {
  rimraf(testRootPath);
};

export function content(path) {
  try {
    return readFileSync(path, {encoding: "utf8"});
  }
  catch (err) {
    return null;
  }
};

export function writeFile(path, content) {
  mkdir(dirname(path));
  writeFileSync(path, content);
};

export function removeFile(path) {
  rimraf(path);
};
