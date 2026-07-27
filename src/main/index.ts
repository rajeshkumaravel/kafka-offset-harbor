import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { BrowserWindow, Menu, app, shell } from 'electron'
import { registerIpcHandlers } from './ipc'
import { disconnectAll } from './kafka/manager'
import { closeStore, initStore } from './store/sqlite'
import { initUpdater } from './updater'

// Name the app before anything reads it. This drives the macOS menu bar, the
// dock tooltip, and the userData directory. (In `npm run dev` the dock icon
// still hovers as "Electron" because the process runs inside the stock
// Electron.app bundle — the packaged .app shows the real name.)
app.setName('Kafka Offset Harbor')

// Test hook: lets automated runs isolate their data directory
if (process.env.KOH_USER_DATA) app.setPath('userData', process.env.KOH_USER_DATA)

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: 'Kafka Offset Harbor',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false
    }
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const key = input.key.toUpperCase();

    if (
      key === 'F12' ||
      (input.control && input.shift && key === 'I') ||
      (input.meta && input.alt && key === 'I')
    ) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('devtools-opened', () => {
    mainWindow?.webContents.closeDevTools();
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Any external navigation opens in the system browser, never in-app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // In dev the packaged .icns isn't applied yet — set the dock icon from the
  // source PNG so the branded icon shows while running `npm run dev`.
  if (!app.isPackaged && process.platform === 'darwin') {
    const devIcon = join(app.getAppPath(), 'resources/icon.png')
    if (existsSync(devIcon)) app.dock?.setIcon(devIcon)
  }

  initStore(app.getPath('userData'))
  registerIpcHandlers(() => mainWindow)
  createWindow()
  if (mainWindow && app.isPackaged) {
    initUpdater(mainWindow)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

Menu.setApplicationMenu(null)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('quit', () => {
  void disconnectAll()
  closeStore()
})
