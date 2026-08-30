const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  safeStorage,
  shell,
} = require("electron");
const { existsSync, readFileSync, renameSync, writeFileSync } = require("node:fs");
const { dirname, extname, join, normalize, relative, resolve } = require("node:path");
const { pathToFileURL } = require("node:url");

const APP_SCHEME = "rawaqan";
const APP_HOST = "app";
const APP_URL = `${APP_SCHEME}://${APP_HOST}/pos`;
const API_ORIGIN = (process.env.RAWAQAN_API_ORIGIN || "https://rawaqan-api.onrender.com").replace(/\/$/, "");
const REFRESH_COOKIE_NAME = "rawaqan_rt";
const VIRTUAL_PRINTER = /pdf|onenote|fax|xps|anydesk/i;

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      allowServiceWorkers: true,
      codeCache: true,
    },
  },
]);

let mainWindow;
let settings;
let printLedger;

function userFile(name) {
  return join(app.getPath("userData"), name);
}

function readJson(name, fallback) {
  try {
    return JSON.parse(readFileSync(userFile(name), "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(name, value) {
  const target = userFile(name);
  const temporary = `${target}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporary, target);
}

function loadSettings() {
  const saved = readJson("settings.json", {});
  return {
    printerName: typeof saved.printerName === "string" ? saved.printerName : "",
    paperProfile: saved.paperProfile === "58mm" ? "58mm" : "80mm",
    autoPrint: saved.autoPrint !== false,
    launchAtLogin: saved.launchAtLogin !== false,
    kioskMode: saved.kioskMode !== false,
  };
}

function saveSettings() {
  writeJsonAtomic("settings.json", settings);
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin });
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setFullScreen(settings.kioskMode);
  }
}

function rendererRoot() {
  return app.isPackaged
    ? join(process.resourcesPath, "renderer")
    : join(__dirname, ".renderer-build", "frontend", "dist");
}

function mimeType(filePath) {
  return (
    {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".ico": "image/x-icon",
      ".jpeg": "image/jpeg",
      ".jpg": "image/jpeg",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".webmanifest": "application/manifest+json; charset=utf-8",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
    }[extname(filePath).toLowerCase()] || "application/octet-stream"
  );
}

function encryptedRefreshCookie() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return "";
    const encrypted = readFileSync(userFile("refresh-cookie.bin"));
    return safeStorage.decryptString(encrypted);
  } catch {
    return "";
  }
}

function storeRefreshCookie(setCookie) {
  const match = setCookie?.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]*)`));
  if (!match) return;
  const value = match[1] || "";
  if (!value || !safeStorage.isEncryptionAvailable()) {
    try {
      writeFileSync(userFile("refresh-cookie.bin"), Buffer.alloc(0));
    } catch {}
    return;
  }
  writeFileSync(userFile("refresh-cookie.bin"), safeStorage.encryptString(value));
}

async function proxyApi(request, url) {
  const target = `${API_ORIGIN}${url.pathname}${url.search}`;
  const headers = new Headers(request.headers);
  headers.delete("origin");
  headers.delete("referer");
  headers.delete("host");
  const refreshCookie = encryptedRefreshCookie();
  if (refreshCookie && url.pathname.startsWith("/api/auth")) {
    headers.set("cookie", `${REFRESH_COOKIE_NAME}=${refreshCookie}`);
  }

  try {
    const hasBody = !["GET", "HEAD"].includes(request.method.toUpperCase());
    const response = await net.fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? Buffer.from(await request.arrayBuffer()) : undefined,
      redirect: "follow",
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) storeRefreshCookie(setCookie);
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("set-cookie");
    responseHeaders.delete("access-control-allow-origin");
    responseHeaders.delete("access-control-allow-credentials");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      {
        success: false,
        error: {
          code: "OFFLINE",
          message: "الخادم غير متاح حالياً. حُفظت عمليات POS محلياً وستتم مزامنتها عند عودة الإنترنت.",
        },
      },
      { status: 503 },
    );
  }
}

async function serveApp(request) {
  const url = new URL(request.url);
  if (url.host !== APP_HOST) return new Response("Not found", { status: 404 });
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    return proxyApi(request, url);
  }

  const root = rendererRoot();
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const normalizedPath = normalize(pathname).replace(/^([/\\])+/, "");
  let filePath = resolve(root, normalizedPath || "index.html");
  const relativePath = relative(root, filePath);
  if (relativePath.startsWith("..") || resolve(filePath) === resolve(dirname(root))) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!existsSync(filePath) || !extname(filePath)) filePath = join(root, "index.html");
  if (!existsSync(filePath)) return new Response("Renderer is missing", { status: 500 });

  const response = await net.fetch(pathToFileURL(filePath).toString());
  const headers = new Headers(response.headers);
  headers.set("content-type", mimeType(filePath));
  headers.set("cache-control", filePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable");
  return new Response(response.body, { status: response.status, headers });
}

async function availablePrinters() {
  if (!mainWindow || mainWindow.isDestroyed()) return [];
  return mainWindow.webContents.getPrintersAsync();
}

async function resolvePrinter() {
  const printers = await availablePrinters();
  if (settings.printerName) {
    const configured = printers.find((printer) => printer.name === settings.printerName);
    if (configured) return configured;
  }
  const physical = printers.filter(
    (printer) => !VIRTUAL_PRINTER.test(`${printer.name} ${printer.displayName || ""}`),
  );
  const selected = physical.find((printer) => printer.isDefault) || (physical.length === 1 ? physical[0] : undefined);
  if (selected) {
    settings.printerName = selected.name;
    saveSettings();
    return selected;
  }
  throw new Error("PRINTER_NOT_CONFIGURED");
}

function printWindowContents(window, options) {
  return new Promise((resolvePrint, rejectPrint) => {
    window.webContents.print(options, (success, failureReason) => {
      if (success) resolvePrint();
      else rejectPrint(new Error(failureReason || "PRINT_JOB_FAILED"));
    });
  });
}

async function printHtml({ html, profile = "80mm", jobId, isReprint = false, automatic = false }) {
  if (typeof html !== "string" || html.length === 0 || html.length > 2_000_000) {
    throw new Error("INVALID_RECEIPT_HTML");
  }
  if (automatic && settings.autoPrint === false) throw new Error("AUTO_PRINT_DISABLED");
  const safeJobId = typeof jobId === "string" ? jobId.slice(0, 200) : "";
  if (!isReprint && safeJobId && printLedger[safeJobId]?.status === "printed") {
    return { ok: true, alreadyPrinted: true, printerName: printLedger[safeJobId].printerName };
  }

  const printer = await resolvePrinter();
  const effectiveProfile = settings.paperProfile === "58mm" ? "58mm" : profile;
  const receiptWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  try {
    await receiptWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await receiptWindow.webContents.executeJavaScript("document.fonts?.ready", true);
    const heightPx = await receiptWindow.webContents.executeJavaScript(
      `Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, document.querySelector('.receipt')?.scrollHeight || 0)`,
      true,
    );
    const widthMicrons = effectiveProfile === "58mm" ? 58_000 : 80_000;
    const heightMicrons = Math.min(3_276_000, Math.max(60_000, Math.ceil((Number(heightPx) / 96) * 25_400) + 4_000));

    await printWindowContents(receiptWindow, {
      silent: true,
      deviceName: printer.name,
      printBackground: true,
      color: false,
      landscape: false,
      margins: { marginType: "none" },
      pageSize: { width: widthMicrons, height: heightMicrons },
      scaleFactor: 100,
      copies: 1,
      collate: false,
    });

    if (!isReprint && safeJobId) {
      printLedger[safeJobId] = {
        status: "printed",
        printerName: printer.name,
        printedAt: new Date().toISOString(),
      };
      const entries = Object.entries(printLedger).slice(-2000);
      printLedger = Object.fromEntries(entries);
      writeJsonAtomic("print-ledger.json", printLedger);
    }
    return { ok: true, alreadyPrinted: false, printerName: printer.name };
  } finally {
    if (!receiptWindow.isDestroyed()) receiptWindow.destroy();
  }
}

async function configurePrinter() {
  const printers = await availablePrinters();
  if (!printers.length) {
    await dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "إعداد الطابعة",
      message: "لم يعثر Windows على أي طابعة.",
      detail: "ثبّت تعريف الطابعة الحرارية وتأكد أنها ظاهرة في إعدادات Windows ثم أعد المحاولة.",
    });
    return { ...settings, printers: [] };
  }

  await new Promise((resolveMenu) => {
    const template = [
      { label: "اختر الطابعة الحرارية", enabled: false },
      { type: "separator" },
      ...printers.map((printer) => ({
        label: printer.displayName || printer.name,
        sublabel: printer.name,
        type: "radio",
        checked: settings.printerName === printer.name,
        click: () => {
          settings.printerName = printer.name;
          saveSettings();
        },
      })),
      { type: "separator" },
      {
        label: "طباعة تلقائية بعد الدفع",
        type: "checkbox",
        checked: settings.autoPrint,
        click: (item) => {
          settings.autoPrint = item.checked;
          saveSettings();
        },
      },
      {
        label: "مقاس ورق الطابعة",
        submenu: [
          {
            label: "80 مم",
            type: "radio",
            checked: settings.paperProfile === "80mm",
            click: () => {
              settings.paperProfile = "80mm";
              saveSettings();
            },
          },
          {
            label: "58 مم",
            type: "radio",
            checked: settings.paperProfile === "58mm",
            click: () => {
              settings.paperProfile = "58mm";
              saveSettings();
            },
          },
        ],
      },
      {
        label: "تشغيل البرنامج مع Windows",
        type: "checkbox",
        checked: settings.launchAtLogin,
        click: (item) => {
          settings.launchAtLogin = item.checked;
          saveSettings();
        },
      },
      {
        label: "وضع ملء الشاشة للكاشير",
        type: "checkbox",
        checked: settings.kioskMode,
        click: (item) => {
          settings.kioskMode = item.checked;
          saveSettings();
        },
      },
    ];
    Menu.buildFromTemplate(template).popup({ window: mainWindow, callback: resolveMenu });
  });
  return { ...settings, printers: printers.map(({ name, displayName, isDefault }) => ({ name, displayName, isDefault })) };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: "#f8f5ef",
    autoHideMenuBar: true,
    fullscreen: settings.kioskMode,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${APP_SCHEME}://${APP_HOST}/`)) {
      event.preventDefault();
      if (url.startsWith("https://") || url.startsWith("http://")) void shell.openExternal(url);
    }
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  void mainWindow.loadURL(APP_URL);
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    settings = loadSettings();
    printLedger = readJson("print-ledger.json", {});
    saveSettings();
    await protocol.handle(APP_SCHEME, serveApp);

    ipcMain.handle("rawaqan:get-settings", async () => ({ ...settings }));
    ipcMain.handle("rawaqan:configure-printer", configurePrinter);
    ipcMain.handle("rawaqan:print-receipt", (_event, job) => printHtml(job || {}));

    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => app.quit());
