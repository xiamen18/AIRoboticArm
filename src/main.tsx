import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import type { NmrApi } from './shared/types'

if (!window.nmrApi && import.meta.env.DEV) {
  const previewApi: NmrApi = {
    connect: async () => { throw new Error('浏览器预览不能建立 TCP 连接，请在 Electron 中运行') },
    disconnect: async () => undefined,
    sendCommand: async () => { throw new Error('浏览器预览不能发送 TCP 命令') },
    getConnectionState: async () => 'disconnected',
    onConnectionStateChanged: () => () => undefined,
    onSocketMessage: () => () => undefined,
  }
  window.nmrApi = previewApi
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
