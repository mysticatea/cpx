import Cpx from "./cpx";

export {Cpx};

export function copy(source, outDir, options = null, cb = null) {
  if (typeof options === "function") {
    cb = options;
    options = null;
  }

  let cpx = new Cpx(source, outDir, options);
  if (options && options.clean) {
    cpx.clean(err => {
      if (err == null) {
        cpx.copy(cb);
      }
      else if (cb != null) {
        cb(err);
      }
    });
  }
  else {
    cpx.copy(cb);
  }

  return cpx;
};

export function copySync(source, outDir, options = null) {
  let cpx = new Cpx(source, outDir, options);
  if (options && options.clean) {
    cpx.cleanSync();
  }
  cpx.copySync();
};

export function watch(source, outDir, options = null) {
  let cpx = new Cpx(source, outDir, options);
  if (options && options.clean) {
    cpx.clean(err => {
      if (err == null) {
        cpx.watch();
      }
      else {
        cpx.emit("watch-error", err);
      }
    });
  }
  else {
    cpx.watch();
  }

  return cpx;
};
