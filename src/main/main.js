const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const store = require('./store');

// 싱글 인스턴스 보장
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow = null;

// 개발 모드 확인
const isDev = !app.isPackaged;

function getWindowConfig() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // 세로모드 전용: 너비 420px, 전체 높이, 우측 고정
  return {
    width: 420,
    height: screenHeight,
    x: screenWidth - 420,
    y: 0
  };
}

function createWindow() {
  const config = getWindowConfig();

  mainWindow = new BrowserWindow({
    ...config,
    frame: false,
    transparent: false,
    backgroundColor: '#141414',
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    movable: true,
    hasShadow: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js')
    }
  });

  // 개발 모드면 localhost, 아니면 빌드된 파일
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  // 창 닫기 이벤트 - 트레이로 최소화
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// 앱 준비 완료
app.whenReady().then(() => {
  createWindow();

  // 트레이 설정
  require('./tray')(mainWindow);
});

// 두 번째 인스턴스 시도 시 기존 창 표시
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// macOS에서 모든 창 닫혀도 앱 유지
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC 핸들러들
ipcMain.handle('get-settings', () => {
  return {
    supabaseUrl: store.get('supabaseUrl'),
    supabaseKey: store.get('supabaseKey'),
    doctorId: store.get('doctorId'),
    doctorCallEnabled: store.get('doctorCallEnabled')
  };
});

ipcMain.handle('save-settings', (event, settings) => {
  Object.keys(settings).forEach(key => {
    store.set(key, settings[key]);
  });
  return true;
});

ipcMain.handle('minimize-widget', () => {
  mainWindow.minimize();
});

ipcMain.handle('hide-widget', () => {
  mainWindow.hide();
});

ipcMain.handle('close-widget', () => {
  app.isQuitting = true;
  app.quit();
});

// 창 표시/숨기기 토글
ipcMain.handle('toggle-widget', () => {
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
  }
});

// 화면 크기 정보 제공
ipcMain.handle('get-screen-info', () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  return {
    width: primaryDisplay.workAreaSize.width,
    height: primaryDisplay.workAreaSize.height
  };
});
