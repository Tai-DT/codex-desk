import {
  createInitialState,
  sanitizeState,
  type AppState,
  type DesktopApi,
} from './types'

const storageKey = 'codex-desk:state'
const browserDataPath = 'browser-storage://codex-desk/state.json'

function readBrowserState(): AppState {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return createInitialState()
    }

    return sanitizeState(JSON.parse(raw))
  } catch {
    return createInitialState()
  }
}

function downloadJson(state: AppState) {
  const fileName = `codex-desk-export-${new Date().toISOString().slice(0, 10)}.json`
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return fileName
}

const browserApi: DesktopApi = {
  async getAppInfo() {
    return {
      version: 'browser',
      updateStatus: {
        status: 'idle',
        currentVersion: 'browser',
        nextVersion: '',
        releaseName: '',
        releaseNotes: '',
        percent: 0,
        bytesPerSecond: 0,
        transferred: 0,
        total: 0,
        message: 'Auto update chỉ khả dụng trong desktop build.',
        checkedAt: '',
      },
    }
  },
  async getState() {
    return {
      state: readBrowserState(),
      dataFilePath: browserDataPath,
    }
  },
  async saveState(state) {
    const nextState = sanitizeState(state)
    window.localStorage.setItem(storageKey, JSON.stringify(nextState))

    return {
      state: nextState,
      dataFilePath: browserDataPath,
    }
  },
  async importState() {
    return { canceled: true }
  },
  async exportState(state) {
    return {
      canceled: false,
      filePath: downloadJson(sanitizeState(state)),
    }
  },
  async openPath() {
    return {
      ok: false,
      message: 'Tính năng mở path chỉ khả dụng trong desktop build.',
    }
  },
  async openDataDirectory() {
    return {
      ok: false,
      message: 'Tính năng mở thư mục dữ liệu chỉ khả dụng trong desktop build.',
    }
  },
  async openAccountSession() {
    return {
      ok: false,
      message: 'Tính năng session riêng chỉ khả dụng trong desktop build.',
    }
  },
  async openCodexWindow() {
    return {
      ok: false,
      message: 'Tính năng mở Codex riêng chỉ khả dụng trong desktop build.',
    }
  },
  async captureMachineCodexAuth() {
    return {
      ok: false,
      message: 'Tính năng chụp auth Codex máy chỉ khả dụng trong desktop build.',
    }
  },
  async switchMachineCodexAuth() {
    return {
      ok: false,
      message: 'Tính năng chuyển Codex máy chỉ khả dụng trong desktop build.',
    }
  },
  async diagnoseCodexAuth() {
    return {
      ok: false,
      message: 'Tính năng chẩn đoán Codex máy chỉ khả dụng trong desktop build.',
    }
  },
  async readMachineCodexUsage() {
    return {
      ok: false,
      message: 'Tính năng đọc usage Codex chỉ khả dụng trong desktop build.',
    }
  },
  async readAccountRenewalDate() {
    return {
      ok: false,
      message: 'Tính năng đọc renewal date chỉ khả dụng trong desktop build.',
    }
  },
  async importChatBackup() {
    return {
      ok: false,
      message: 'Tính năng import backup chat chỉ khả dụng trong desktop build.',
    }
  },
  async readChatBackup() {
    return {
      ok: false,
      message: 'Tính năng đọc backup chat chỉ khả dụng trong desktop build.',
    }
  },
  async resetAccountSession() {
    return {
      ok: false,
      message: 'Tính năng session riêng chỉ khả dụng trong desktop build.',
    }
  },
  async syncAccountSession() {
    return {
      ok: false,
      message: 'Tính năng đồng bộ session chỉ khả dụng trong desktop build.',
    }
  },
  async checkForUpdates() {
    return {
      ok: false,
      message: 'Tính năng cập nhật chỉ khả dụng trong desktop build.',
    }
  },
  async installUpdate() {
    return {
      ok: false,
      message: 'Tính năng cập nhật chỉ khả dụng trong desktop build.',
    }
  },
  onUpdateStatus() {
    return () => {}
  },
}

export const desktopApi = window.managerCodex ?? browserApi
