const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 설정 관련
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // 모드 관련
  getMode: () => ipcRenderer.invoke('get-mode'),
  switchMode: (mode) => ipcRenderer.invoke('switch-mode', mode),

  // 창 제어
  minimize: () => ipcRenderer.invoke('minimize-widget'),
  hide: () => ipcRenderer.invoke('hide-widget'),
  close: () => ipcRenderer.invoke('close-widget'),
  toggle: () => ipcRenderer.invoke('toggle-widget'),

  // 화면 정보
  getScreenInfo: () => ipcRenderer.invoke('get-screen-info'),

  // 이벤트 리스너
  onModeChanged: (callback) => {
    ipcRenderer.on('mode-changed', (event, mode) => callback(mode));
  },

  // 리스너 제거
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
