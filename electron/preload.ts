import { contextBridge, ipcRenderer } from 'electron'
import type { ConnectionState, NmrApi, SocketMessage } from '../src/shared/types'

const api: NmrApi = {
  connect: (config) => ipcRenderer.invoke('nmr:connect', config),
  disconnect: () => ipcRenderer.invoke('nmr:disconnect'),
  sendCommand: (request) => ipcRenderer.invoke('nmr:send-command', request),
  getConnectionState: () => ipcRenderer.invoke('nmr:get-connection-state'),
  onConnectionStateChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: ConnectionState) => callback(state)
    ipcRenderer.on('nmr:connection-state', listener)
    return () => ipcRenderer.removeListener('nmr:connection-state', listener)
  },
  onSocketMessage: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, message: SocketMessage) => callback(message)
    ipcRenderer.on('nmr:socket-message', listener)
    return () => ipcRenderer.removeListener('nmr:socket-message', listener)
  },
}

contextBridge.exposeInMainWorld('nmrApi', api)
