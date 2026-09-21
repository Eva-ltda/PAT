const { contextBridge, ipcRenderer } = require("electron");

function readArg(key) {
  const prefix = `--${key}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return "";
  return hit.slice(prefix.length);
}

const socketUrl = readArg("socketUrl");
const appVersion = readArg("appVersion");

contextBridge.exposeInMainWorld("DashboardArduino", {
  socketUrl,
  appVersion,
  platform: process.platform,
  getAppVersion: () => Promise.resolve(appVersion || process.env.npm_package_version || ""),
  exportCsv: (args) => ipcRenderer.invoke("dashboard:exportCsv", args),
  listSerialPorts: () => ipcRenderer.invoke("dashboard:listSerialPorts"),
  setSerialPort: (portPath) => ipcRenderer.invoke("dashboard:setSerialPort", { portPath }),
  serialDisconnectManual: () => ipcRenderer.invoke("dashboard:serialDisconnectManual"),
  serialConnectManual: () => ipcRenderer.invoke("dashboard:serialConnectManual"),
  setCollecting: (collecting) => ipcRenderer.invoke("dashboard:setCollecting", { collecting }),
  runBackupManual: () => ipcRenderer.invoke("dashboard:runBackupManual"),
  getBackupInfo: () => ipcRenderer.invoke("dashboard:getBackupInfo"),
  getStatus: () => ipcRenderer.invoke("dashboard:getStatus"),
  getSessionInfo: () => ipcRenderer.invoke("dashboard:getSessionInfo")
});
