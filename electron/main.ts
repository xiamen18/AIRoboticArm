import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import type { CommandRequest, ConnectionConfig, ConnectionState, SocketMessage } from '../src/shared/types'
import { NmrTcpClient } from './tcp-client'

const tcpClient = new NmrTcpClient()
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: '#07131f',
    title: 'NMR 自动送样 · 通信调试台',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }
  mainWindow.on('closed', () => { mainWindow = null })
}

function broadcast(channel: string, payload: ConnectionState | SocketMessage): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

tcpClient.on('state', (state: ConnectionState) => broadcast('nmr:connection-state', state))
tcpClient.on('message', (message: SocketMessage) => broadcast('nmr:socket-message', message))

ipcMain.handle('nmr:connect', (_event, config: ConnectionConfig) => tcpClient.connect(config))
ipcMain.handle('nmr:disconnect', () => tcpClient.disconnect())
ipcMain.handle('nmr:send-command', (_event, request: CommandRequest) => tcpClient.send(request))
ipcMain.handle('nmr:get-connection-state', () => tcpClient.connectionState)

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  tcpClient.disconnect()
  if (process.platform !== 'darwin') app.quit()
})
