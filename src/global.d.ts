export {};

declare global {
  interface Window {
    DashboardArduino?: {
      socketUrl: string;
      appVersion: string;
      platform: string;
      exportCsv?: (args: { csvText: string; defaultFileName?: string }) => Promise<
        | { canceled: true }
        | { canceled: false; filePath: string }
      >;
      listSerialPorts?: () => Promise<
        { path: string; manufacturer?: string; vendorId?: string; productId?: string }[]
      >;
      setSerialPort?: (portPath: string) => Promise<{ ok: true }>;
    };
  }

  interface ImportMetaEnv {
    readonly VITE_SOCKET_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
