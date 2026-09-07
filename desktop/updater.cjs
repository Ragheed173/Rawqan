const CHECK_DELAY_MS = 15_000;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

function errorMessage(error) {
  const message = error instanceof Error ? error.message : String(error || "unknown error");
  return message.replace(/[\r\n]+/g, " ").slice(0, 500);
}

function initializeAutoUpdates({
  app,
  autoUpdater,
  dialog,
  getMainWindow,
  logger = console,
  setTimeoutFn = setTimeout,
  setIntervalFn = setInterval,
}) {
  if (!app.isPackaged) {
    logger.info("[updater] Skipped outside a packaged build.");
    return { enabled: false };
  }

  let checkInProgress = false;
  let installPromptOpen = false;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  const check = async () => {
    if (checkInProgress) return;
    checkInProgress = true;
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      // An unavailable network is normal for this offline-first application.
      logger.warn(`[updater] Update check failed: ${errorMessage(error)}`);
    } finally {
      checkInProgress = false;
    }
  };

  autoUpdater.on("checking-for-update", () => logger.info("[updater] Checking for updates."));
  autoUpdater.on("update-available", (info) =>
    logger.info(`[updater] Downloading version ${info?.version || "unknown"}.`),
  );
  autoUpdater.on("update-not-available", () => logger.info("[updater] Application is current."));
  autoUpdater.on("error", (error) =>
    logger.warn(`[updater] Background update failed: ${errorMessage(error)}`),
  );
  autoUpdater.on("update-downloaded", async (info) => {
    if (installPromptOpen) return;
    installPromptOpen = true;
    try {
      const window = getMainWindow();
      const options = {
        type: "info",
        title: "تحديث روقان POS جاهز",
        message: `تم تنزيل الإصدار ${info?.version || "الجديد"}.`,
        detail: "أكمل الطلب الحالي أولاً، ثم أعد تشغيل التطبيق لتثبيت التحديث.",
        buttons: ["إعادة التشغيل والتثبيت", "لاحقاً"],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      };
      const result = window && !window.isDestroyed()
        ? await dialog.showMessageBox(window, options)
        : await dialog.showMessageBox(options);
      if (result.response === 0) autoUpdater.quitAndInstall(false, true);
    } catch (error) {
      logger.warn(`[updater] Could not show install prompt: ${errorMessage(error)}`);
    } finally {
      installPromptOpen = false;
    }
  });

  const initialTimer = setTimeoutFn(() => void check(), CHECK_DELAY_MS);
  initialTimer?.unref?.();
  const intervalTimer = setIntervalFn(() => void check(), CHECK_INTERVAL_MS);
  intervalTimer?.unref?.();

  return { enabled: true, check };
}

module.exports = { CHECK_DELAY_MS, CHECK_INTERVAL_MS, initializeAutoUpdates };
