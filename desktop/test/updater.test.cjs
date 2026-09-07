const { EventEmitter } = require("node:events");
const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeAutoUpdates } = require("../updater.cjs");

function setup({ packaged = true, response = 1 } = {}) {
  const updater = new EventEmitter();
  const calls = { checks: 0, dialogs: [], install: [], timers: [] };
  updater.checkForUpdates = async () => {
    calls.checks += 1;
    return { updateInfo: { version: "1.3.1" } };
  };
  updater.quitAndInstall = (...args) => calls.install.push(args);
  const controller = initializeAutoUpdates({
    app: { isPackaged: packaged },
    autoUpdater: updater,
    dialog: {
      showMessageBox: async (...args) => {
        calls.dialogs.push(args);
        return { response };
      },
    },
    getMainWindow: () => ({ isDestroyed: () => false }),
    logger: { info() {}, warn() {} },
    setTimeoutFn: (fn, delay) => {
      calls.timers.push({ kind: "timeout", fn, delay });
      return { unref() {} };
    },
    setIntervalFn: (fn, delay) => {
      calls.timers.push({ kind: "interval", fn, delay });
      return { unref() {} };
    },
  });
  return { updater, calls, controller };
}

test("does not enable updates in development", () => {
  const { controller, calls } = setup({ packaged: false });
  assert.equal(controller.enabled, false);
  assert.equal(calls.timers.length, 0);
});

test("checks after startup and every four hours", async () => {
  const { controller, calls } = setup();
  assert.equal(controller.enabled, true);
  assert.deepEqual(calls.timers.map(({ kind, delay }) => ({ kind, delay })), [
    { kind: "timeout", delay: 15_000 },
    { kind: "interval", delay: 4 * 60 * 60 * 1000 },
  ]);
  calls.timers[0].fn();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.checks, 1);
});

test("installs a downloaded update only after confirmation", async () => {
  const { updater, calls } = setup({ response: 0 });
  updater.emit("update-downloaded", { version: "1.3.1" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.dialogs.length, 1);
  assert.deepEqual(calls.install, [[false, true]]);
});

test("defers installation when the cashier chooses later", async () => {
  const { updater, calls } = setup({ response: 1 });
  updater.emit("update-downloaded", { version: "1.3.1" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.dialogs.length, 1);
  assert.equal(calls.install.length, 0);
});
