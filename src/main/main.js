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

  // 저장된 높이 불러오기 (없으면 화면 높이 사용)
  const savedHeight = store.get('windowHeight') || screenHeight;

  // 세로모드 전용: 너비 420px 고정, 높이는 저장된 값 사용, 우측 고정
  return {
    width: 420,
    height: Math.min(savedHeight, screenHeight),
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
    resizable: true,
    minWidth: 420,
    maxWidth: 420,
    minHeight: 300,
    movable: true,
    hasShadow: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js')
    }
  });

  // 창 크기 변경 시 높이 저장
  mainWindow.on('resize', () => {
    const [, height] = mainWindow.getSize();
    store.set('windowHeight', height);
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

ipcMain.handle('toggle-height', () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { height: screenHeight } = primaryDisplay.workAreaSize;
  const [width, currentHeight] = mainWindow.getSize();
  const [x] = mainWindow.getPosition();

  const minHeight = 300;
  const isMaximized = currentHeight >= screenHeight - 50; // 약간의 여유

  if (isMaximized) {
    // 최소 높이로 (하단 고정)
    mainWindow.setBounds({ x, y: screenHeight - minHeight, width, height: minHeight });
    store.set('windowHeight', minHeight);
  } else {
    // 최대 높이로 (상단부터)
    mainWindow.setBounds({ x, y: 0, width, height: screenHeight });
    store.set('windowHeight', screenHeight);
  }
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
