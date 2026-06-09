import { contextBridge } from 'electron';

/**
 * Expose a minimal, safe API to the renderer (Angular).
 * Never expose Node.js APIs or ipcRenderer directly.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
});
