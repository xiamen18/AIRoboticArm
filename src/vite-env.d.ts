/// <reference types="vite/client" />

import type { NmrApi } from './shared/types'

declare global {
  interface Window {
    nmrApi: NmrApi
  }
}

export {}
