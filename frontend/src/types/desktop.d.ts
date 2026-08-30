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
