interface RawaqanDesktopSettings {
  printerName: string;
  paperProfile: "80mm" | "58mm";
  autoPrint: boolean;
  launchAtLogin: boolean;
}

interface RawaqanDesktopPrintJob {
  html: string;
  profile: "80mm" | "58mm";
  jobId: string;
  isReprint: boolean;
  automatic: boolean;
}

interface RawaqanDesktopBridge {
  readonly isDesktop: true;
  getSettings(): Promise<RawaqanDesktopSettings>;
  getAppInfo?(): Promise<{
    version: string;
    mode: "standalone-cloud-sync";
    cloudOrigin: string;
  }>;
  getBackupStatus?(): Promise<{
    available: boolean;
    directory: string;
    fileName?: string;
    lastBackupAt?: string;
  }>;
  saveLocalBackup?(snapshot: import("@/pos/db/backup").PosBackupSnapshot): Promise<{
    ok: boolean;
    path: string;
    encrypted: boolean;
    lastBackupAt: string;
  }>;
  configurePrinter(): Promise<RawaqanDesktopSettings & { printers?: unknown[] }>;
  clearSession(): Promise<{ ok: boolean }>;
  printReceipt(job: RawaqanDesktopPrintJob): Promise<{
    ok: boolean;
    alreadyPrinted: boolean;
    printerName: string;
  }>;
}

interface Window {
  rawaqanDesktop?: RawaqanDesktopBridge;
}
