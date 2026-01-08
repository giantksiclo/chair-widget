const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

let tray = null;

function createTray(mainWindow) {
  // 트레이 아이콘 생성
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');

  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = createDefaultIcon();
    }
  } catch {
    icon = createDefaultIcon();
  }

  tray = new Tray(icon);
  tray.setToolTip('Chair Widget - 체어모드');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '위젯 표시',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: '위젯 숨기기',
      click: () => {
        mainWindow.hide();
      }
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // 왼쪽 클릭 시 창 표시
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}

function createDefaultIcon() {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - size / 2;
      const dy = y - size / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < size / 2 - 1) {
        canvas[idx] = 66;
        canvas[idx + 1] = 133;
        canvas[idx + 2] = 244;
        canvas[idx + 3] = 255;
      } else {
        canvas[idx] = 0;
        canvas[idx + 1] = 0;
        canvas[idx + 2] = 0;
        canvas[idx + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, {
    width: size,
    height: size
  });
}

module.exports = createTray;
