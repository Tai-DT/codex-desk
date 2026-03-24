import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  session,
  shell,
  Tray,
} from 'electron'
import electronUpdater from 'electron-updater'
import JSZip from 'jszip'
import { spawn } from 'node:child_process'
import { constants as fsConstants, existsSync } from 'node:fs'
import { access, copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type ChatBackupConversation,
  type ChatBackupConversationMessage,
  type ChatBackupImportPayload,
  type ChatBackupReadPayload,
  type ChatBackupRecord,
  type CodexUsageReadPayload,
  type CodexUsageReadResult,
  type CodexUsageSnapshot,
  type CodexUsageWindowSnapshot,
  createInitialState,
  getAccountPartition,
  sanitizeState,
  type AppState,
  type DiagnoseCodexAuthPayload,
  type MachineCodexPayload,
  type OpenAccountSessionPayload,
  type RenewalDateReadPayload,
  type RenewalDateReadResult,
  type SessionActionPayload,
  type SessionProfileSnapshot,
  type SyncAccountSessionPayload,
  type UpdateStatusSnapshot,
} from '../src/types'

const APP_NAME = 'Codex Desk'
const APP_ID = 'com.codexdesk.app'
const dataFileName = 'codex-desk-state.json'
const { autoUpdater } = electronUpdater
const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const accountWindows = new Map<string, BrowserWindow>()
let mainWindow: BrowserWindow | null = null
let codexWindow: BrowserWindow | null = null
let codexPartition = ''
let tray: Tray | null = null
let isQuitting = false
let updateCheckStarted = false
const machineCodexSnapshotRootName = 'machine-codex'
const chatBackupRootName = 'chat-backups'
const syncProbeUrls = [
  'https://chatgpt.com/api/auth/session',
  'https://chatgpt.com/backend-api/accounts/check/v4-2023-04-27',
  'https://chatgpt.com/backend-api/me',
  'https://chatgpt.com/backend-api/models',
] as const
const runtimeIconCandidates = [
  path.join(process.resourcesPath, 'icons', 'app-icon.png'),
  path.resolve(currentDirectory, '../build/icons/app-icon.png'),
  path.resolve(currentDirectory, '../src/assets/app-icon.png'),
]

app.setName(APP_NAME)

type UnknownRecord = Record<string, unknown>

type EndpointProbe = {
  ok: boolean
  status: number
  body?: unknown
  error?: string
}

type ProbeWindowSnapshot = {
  url: string
  title: string
  endpoints: Record<string, EndpointProbe>
  storageEntries: Array<{
    key: string
    value: string
  }>
}

type RenewalProbeStorageEntry = {
  scope: 'localStorage' | 'sessionStorage'
  key: string
  value: string
}

type RenewalProbeSnapshot = {
  url: string
  title: string
  bodyText: string
  storageEntries: RenewalProbeStorageEntry[]
}

type RenewalDateMatch = {
  renewalDate: string
  source: string
  matchedText: string
}

type MachineCodexAuthSnapshot = {
  accountId: string
  authMode: string
}

type MachineCodexAuthIdentity = MachineCodexAuthSnapshot & {
  email: string
  name: string
}

type MachineCodexLoginTask = {
  authUrl: string
  child: ReturnType<typeof spawn>
}

const machineCodexLoginTasks = new Map<string, MachineCodexLoginTask>()
let updateStatus: UpdateStatusSnapshot = {
  status: 'idle',
  currentVersion: app.getVersion(),
  nextVersion: '',
  releaseName: '',
  releaseNotes: '',
  percent: 0,
  bytesPerSecond: 0,
  transferred: 0,
  total: 0,
  message: '',
  checkedAt: '',
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

function coerceRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : {}
}

function coerceString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

function normalizeTimestamp(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = value > 1_000_000_000_000 ? value : value * 1000
    const parsed = new Date(milliseconds)
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
  }

  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) {
      return normalizeTimestamp(numeric)
    }

    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
  }

  return ''
}

function extractStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value]
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractStrings(entry))
  }

  if (typeof value === 'object' && value !== null) {
    return Object.values(value as UnknownRecord).flatMap((entry) =>
      extractStrings(entry),
    )
  }

  return []
}

function normalizeMessageText(value: unknown) {
  const combined = extractStrings(value)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join('\n\n')

  return combined.trim()
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')

  try {
    return Buffer.from(padded, 'base64').toString('utf8')
  } catch {
    return ''
  }
}

function parseJwtPayload(rawToken: string) {
  const segments = rawToken.split('.')
  if (segments.length < 2) {
    return null
  }

  return parseJsonValue<UnknownRecord>(decodeBase64Url(segments[1]))
}

async function readMachineCodexAuthSnapshot(targetPath: string) {
  try {
    const raw = await readFile(targetPath, 'utf8')
    const parsed = coerceRecord(JSON.parse(raw))
    const tokens = coerceRecord(parsed.tokens)

    return {
      accountId: coerceString(tokens.account_id).trim(),
      authMode: coerceString(parsed.auth_mode).trim(),
    } satisfies MachineCodexAuthSnapshot
  } catch {
    return null
  }
}

async function readMachineCodexAuthIdentity(targetPath: string) {
  try {
    const raw = await readFile(targetPath, 'utf8')
    const parsed = coerceRecord(JSON.parse(raw))
    const tokens = coerceRecord(parsed.tokens)
    const jwtPayload = coerceRecord(parseJwtPayload(coerceString(tokens.id_token)))

    return {
      accountId: coerceString(tokens.account_id).trim(),
      authMode: coerceString(parsed.auth_mode).trim(),
      email: coerceString(jwtPayload.email).trim(),
      name: coerceString(jwtPayload.name).trim(),
    } satisfies MachineCodexAuthIdentity
  } catch {
    return null
  }
}

function getMachineCodexRootPath() {
  return path.join(app.getPath('userData'), machineCodexSnapshotRootName)
}

function getMachineCodexAccountHomePath(accountId: string) {
  return path.join(getMachineCodexRootPath(), accountId)
}

function getMachineCodexSnapshotPath(accountId: string) {
  return path.join(getMachineCodexAccountHomePath(accountId), 'auth.json')
}

function getChatBackupRootPath() {
  return path.join(app.getPath('userData'), chatBackupRootName)
}

function getChatBackupStoragePath(accountId: string, backupId: string) {
  return path.join(getChatBackupRootPath(), accountId, `${backupId}.json`)
}

function getRuntimeIconPath() {
  return runtimeIconCandidates.find((candidate) => existsSync(candidate))
}

function getBrowserWindowIconOptions() {
  if (process.platform === 'darwin') {
    return {}
  }

  const iconPath = getRuntimeIconPath()
  return iconPath ? { icon: iconPath } : {}
}

function applyAppIcon() {
  const iconPath = getRuntimeIconPath()
  if (!iconPath) {
    return
  }

  const icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) {
    return
  }

  if (process.platform === 'darwin') {
    app.dock?.setIcon(icon)
  }
}

function createTrayIcon() {
  const iconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
      <path
        fill="black"
        d="M3 2.25A1.75 1.75 0 0 0 1.25 4v8c0 .966.784 1.75 1.75 1.75h10A1.75 1.75 0 0 0 14.75 12V4A1.75 1.75 0 0 0 13 2.25H3Zm0 1.5h10A.25.25 0 0 1 13.25 4v2.25h-10V4c0-.138.112-.25.25-.25Zm.25 4h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1 0-1.5Zm5.5 0h4a.75.75 0 0 1 0 1.5h-4a.75.75 0 0 1 0-1.5Zm-5.5 3h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5Z"
      />
    </svg>
  `
  const size = process.platform === 'darwin' ? 18 : 16
  const image = nativeImage
    .createFromDataURL(
      `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString('base64')}`,
    )
    .resize({ width: size, height: size })

  if (process.platform === 'darwin') {
    image.setTemplateImage(true)
  }

  return image
}

function rebuildTrayMenu() {
  if (!tray) {
    return
  }

  const window = mainWindow
  const isVisible = Boolean(window && !window.isDestroyed() && window.isVisible())

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: isVisible ? 'An Codex Desk' : 'Mo Codex Desk',
        click: () => {
          if (isVisible) {
            hideMainWindow()
            return
          }

          void showMainWindow()
        },
      },
      { type: 'separator' },
      {
        label: 'Thoat',
        click: () => {
          isQuitting = true
          app.quit()
        },
      },
    ]),
  )
}

function ensureTray() {
  if (tray) {
    rebuildTrayMenu()
    return tray
  }

  tray = new Tray(createTrayIcon())
  tray.setToolTip(APP_NAME)
  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
      hideMainWindow()
      return
    }

    void showMainWindow()
  })

  rebuildTrayMenu()
  return tray
}

function hideMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }

  ensureTray()
  mainWindow.setSkipTaskbar(true)
  mainWindow.hide()

  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  rebuildTrayMenu()
}

async function showMainWindow() {
  if (process.platform === 'darwin') {
    app.dock?.show()
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    await createWindow()
    rebuildTrayMenu()
    return
  }

  mainWindow.setSkipTaskbar(false)

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.show()
  mainWindow.focus()
  rebuildTrayMenu()
}

function normalizeReleaseNotes(value: unknown) {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (!Array.isArray(value)) {
    return ''
  }

  return value
    .map((entry) => {
      const record = coerceRecord(entry)
      return coerceString(record.note).trim()
    })
    .filter(Boolean)
    .join('\n\n')
}

function broadcastUpdateStatus(partial: Partial<UpdateStatusSnapshot>) {
  updateStatus = {
    ...updateStatus,
    ...partial,
    currentVersion: app.getVersion(),
  }

  if (!updateStatus.checkedAt && updateStatus.status !== 'idle') {
    updateStatus.checkedAt = new Date().toISOString()
  }

  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send('manager:update-status', updateStatus)
    }
  })
}

function isAutoUpdateSupported() {
  return app.isPackaged && (process.platform === 'win32' || process.platform === 'darwin')
}

function normalizeUpdaterErrorMessage(error: unknown) {
  const rawMessage =
    error instanceof Error ? error.message.trim() : coerceString(error).trim()

  if (!rawMessage) {
    return 'Khong kiem tra duoc ban cap nhat.'
  }

  if (
    rawMessage.includes('ERR_UPDATER_LATEST_VERSION_NOT_FOUND') ||
    rawMessage.includes('Unable to find latest version on GitHub') ||
    rawMessage.includes('Cannot parse releases feed')
  ) {
    return 'Khong tim thay GitHub release da publish cho auto-update. Kiem tra release moi nhat khong o trang thai draft va da co file latest.yml/latest-mac.yml.'
  }

  if (
    rawMessage.includes('ERR_UPDATER_CHANNEL_FILE_NOT_FOUND') ||
    rawMessage.includes('Cannot find latest.yml') ||
    rawMessage.includes('Cannot find latest-mac.yml')
  ) {
    return 'GitHub release moi nhat chua co du file auto-update (latest.yml/latest-mac.yml).'
  }

  if (rawMessage.includes('ECONN') || rawMessage.includes('network') || rawMessage.includes('timeout')) {
    return 'Khong the ket noi toi may chu cap nhat. Kiem tra mang va thu lai.'
  }

  return rawMessage
}

async function checkForAppUpdates(manual = false) {
  if (!isAutoUpdateSupported()) {
    const unsupportedMessage = 'Auto-update chi hoat dong trong desktop build dong goi.'

    broadcastUpdateStatus({
      status: 'idle',
      nextVersion: '',
      percent: 0,
      message: unsupportedMessage,
      checkedAt: manual ? new Date().toISOString() : updateStatus.checkedAt,
    })

    return {
      ok: false,
      message: unsupportedMessage,
      updateStatus,
    }
  }

  try {
    broadcastUpdateStatus({
      status: 'checking',
      nextVersion: '',
      percent: 0,
      message: 'Dang kiem tra ban cap nhat...',
      checkedAt: new Date().toISOString(),
    })

    await autoUpdater.checkForUpdates()

    return {
      ok: true,
      updateStatus,
    }
  } catch (error) {
    const message = normalizeUpdaterErrorMessage(error)

    broadcastUpdateStatus({
      status: 'error',
      message,
      checkedAt: new Date().toISOString(),
    })

    return {
      ok: false,
      message,
      updateStatus,
    }
  }
}

function configureAutoUpdater() {
  if (updateCheckStarted) {
    return
  }

  updateCheckStarted = true
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    broadcastUpdateStatus({
      status: 'checking',
      message: 'Dang kiem tra ban cap nhat...',
      checkedAt: new Date().toISOString(),
    })
  })

  autoUpdater.on('update-available', (info) => {
    broadcastUpdateStatus({
      status: 'available',
      nextVersion: coerceString(info.version).trim(),
      releaseName: coerceString(info.releaseName).trim(),
      releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      percent: 0,
      transferred: 0,
      total: 0,
      message: `Da tim thay ban moi ${coerceString(info.version).trim() || ''}. Dang tai ve...`.trim(),
      checkedAt: new Date().toISOString(),
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    broadcastUpdateStatus({
      status: 'not-available',
      nextVersion: coerceString(info.version).trim(),
      percent: 0,
      message: 'Ban dang o phien ban moi nhat.',
      checkedAt: new Date().toISOString(),
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    const nextVersion = updateStatus.nextVersion
    const percent = Number.isFinite(progress.percent) ? progress.percent : 0

    broadcastUpdateStatus({
      status: 'downloading',
      nextVersion,
      percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
      message: `Dang tai ban ${nextVersion || 'moi'}... ${percent.toFixed(0)}%`,
      checkedAt: new Date().toISOString(),
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    broadcastUpdateStatus({
      status: 'downloaded',
      nextVersion: coerceString(info.version).trim(),
      releaseName: coerceString(info.releaseName).trim(),
      releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      percent: 100,
      message: `Da tai xong ban ${coerceString(info.version).trim() || 'moi'}. Bam cai dat de khoi dong lai app.`,
      checkedAt: new Date().toISOString(),
    })
  })

  autoUpdater.on('error', (error) => {
    broadcastUpdateStatus({
      status: 'error',
      message: normalizeUpdaterErrorMessage(error),
      checkedAt: new Date().toISOString(),
    })
  })
}

function getGlobalCodexAuthPath() {
  return path.join(app.getPath('home'), '.codex', 'auth.json')
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function runBestEffort(command: string, args: string[]) {
  await new Promise<void>((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore' })

    child.once('error', () => resolve())
    child.once('close', () => resolve())
  })
}

async function readCommandOutput(command: string, args: string[]) {
  return await new Promise<string>((resolve) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString()
    })
    child.once('error', () => resolve(''))
    child.once('close', () => resolve((stdout || stderr).trim()))
  })
}

async function isCodexDesktopRunning() {
  if (process.platform !== 'darwin') {
    return false
  }

  const output = await readCommandOutput('pgrep', [
    '-f',
    '/Applications/Codex.app/Contents/MacOS/Codex|/Applications/Codex.app/Contents/Resources/codex app-server',
  ])

  return Boolean(output)
}

async function waitForCodexDesktopExit(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (!(await isCodexDesktopRunning())) {
      return true
    }

    await delay(250)
  }

  return !(await isCodexDesktopRunning())
}

async function stopCodexDesktop() {
  if (process.platform === 'darwin') {
    await runBestEffort('osascript', ['-e', 'tell application "Codex" to quit'])

    if (await waitForCodexDesktopExit(5000)) {
      return
    }

    await runBestEffort('pkill', [
      '-TERM',
      '-f',
      '/Applications/Codex.app/Contents/MacOS/Codex|/Applications/Codex.app/Contents/Resources/codex app-server',
    ])

    if (await waitForCodexDesktopExit(5000)) {
      return
    }

    await runBestEffort('pkill', [
      '-KILL',
      '-f',
      '/Applications/Codex.app/Contents/MacOS/Codex|/Applications/Codex.app/Contents/Resources/codex app-server',
    ])
    await waitForCodexDesktopExit(2000)
    return
  }

  if (process.platform === 'win32') {
    await runBestEffort('taskkill', ['/IM', 'Codex.exe', '/F'])
    await delay(700)
  }
}

async function spawnDetached(
  command: string,
  args: string[],
  envOverrides: NodeJS.ProcessEnv = {},
) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, ...envOverrides },
    })

    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

async function resolveCodexExecutable() {
  if (process.platform === 'darwin') {
    const macExecutable = '/Applications/Codex.app/Contents/Resources/codex'
    if (await pathExists(macExecutable)) {
      return macExecutable
    }
  }

  return 'codex'
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function decodeCookieValue(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function extractEmailFromEncodedAuthInfo(rawValue: string) {
  const decoded = decodeCookieValue(rawValue)
  const parsed = parseJsonValue<UnknownRecord>(decoded)

  if (!parsed || !isRecord(parsed.user)) {
    return ''
  }

  return asString(parsed.user.email)
}

function parseJsonValue<T>(raw: string) {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

type StoredChatBackupFile = {
  schemaVersion: 1
  backup: ChatBackupRecord
  conversations: ChatBackupConversation[]
}

type StoredCodexUsageSessionEntry = {
  timestamp?: string
  payload?: {
    rate_limits?: {
      primary?: unknown
      secondary?: unknown
      credits?: unknown
      plan_type?: unknown
      limit_reached?: unknown
    }
  }
}

function compareIsoDates(left: string, right: string) {
  if (!left && !right) {
    return 0
  }

  if (!left) {
    return 1
  }

  if (!right) {
    return -1
  }

  return right.localeCompare(left)
}

function normalizeVisibleText(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatDateOnlyParts(year: number, month: number, day: number) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return ''
  }

  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return ''
  }

  return `${year.toString().padStart(4, '0')}-${month
    .toString()
    .padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

const englishMonthNumbers: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

const renewalKeywordPattern =
  /(renew|renewal|auto-renew|billing|payment|invoice|subscription|period|expire|expiration|cancel|downgrade|gia han|het han|huy)/i

function parseLooseDateCandidate(rawValue: string) {
  const value = normalizeVisibleText(rawValue)
    .replace(/^(on|vao|ngay|date|ngay reset)\s+/i, '')
    .replace(/[|•]/g, ' ')

  if (!value) {
    return ''
  }

  let match = value.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
  if (match) {
    return formatDateOnlyParts(Number(match[1]), Number(match[2]), Number(match[3]))
  }

  match = value.match(/\b(\d{1,2})\s*(?:thg|thang|thang\.?)\s*(\d{1,2}),?\s*(\d{4})\b/i)
  if (match) {
    return formatDateOnlyParts(Number(match[3]), Number(match[2]), Number(match[1]))
  }

  match = value.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/i,
  )
  if (match) {
    const month = englishMonthNumbers[match[1].toLowerCase()]
    return formatDateOnlyParts(Number(match[3]), month, Number(match[2]))
  }

  match = value.match(
    /\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?),?\s+(\d{4})\b/i,
  )
  if (match) {
    const month = englishMonthNumbers[match[2].toLowerCase()]
    return formatDateOnlyParts(Number(match[3]), month, Number(match[1]))
  }

  match = value.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/)
  if (match) {
    const first = Number(match[1])
    const second = Number(match[2])
    const year = Number(match[3])
    if (first > 12) {
      return formatDateOnlyParts(year, second, first)
    }
    if (second > 12) {
      return formatDateOnlyParts(year, first, second)
    }
    return formatDateOnlyParts(year, second, first)
  }

  return ''
}

function buildRenewalDateMatch(
  candidate: string,
  source: string,
  matchedText: string,
): RenewalDateMatch | null {
  const renewalDate = parseLooseDateCandidate(candidate)
  if (!renewalDate) {
    return null
  }

  return {
    renewalDate,
    source,
    matchedText: normalizeVisibleText(matchedText).slice(0, 240),
  }
}

function extractRenewalDateFromText(
  rawText: string,
  source: string,
): RenewalDateMatch | null {
  const text = normalizeVisibleText(rawText)
  if (!text) {
    return null
  }

  const contextualPatterns = [
    /your plan renews on ([^.]+?)(?=(?:\s{2,}|$))/i,
    /your plan renews .*? on ([^.]+?)(?=(?:\s{2,}|$))/i,
    /your plan auto-renews on ([^.]+?)(?=(?:\s{2,}|$))/i,
    /your plan auto-renews .*? on ([^.]+?)(?=(?:\s{2,}|$))/i,
    /your plan will cancel on ([^.]+?)(?=(?:\s{2,}|$))/i,
    /your plan will expire on ([^.]+?)(?=(?:\s{2,}|$))/i,
    /your paid plan will downgrade to chatgpt free on ([^.]+?)(?=(?:\s{2,}|$))/i,
    /your plan changes to .*? on ([^.]+?)(?=(?:\s{2,}|$))/i,
    /next billing date[: ]+([^.]+?)(?=(?:\s{2,}|$))/i,
    /next payment(?: date)?[: ]+([^.]+?)(?=(?:\s{2,}|$))/i,
    /next invoice(?: date)?[: ]+([^.]+?)(?=(?:\s{2,}|$))/i,
    /current period ends?[: ]+([^.]+?)(?=(?:\s{2,}|$))/i,
    /renews? on ([^.]+?)(?=(?:\s{2,}|$))/i,
    /auto-renews? on ([^.]+?)(?=(?:\s{2,}|$))/i,
    /gia han(?: vao| ngay)?[: ]+([^.]+?)(?=(?:\s{2,}|$))/i,
    /tu dong gia han(?: vao| ngay)?[: ]+([^.]+?)(?=(?:\s{2,}|$))/i,
    /het han(?: vao| ngay)?[: ]+([^.]+?)(?=(?:\s{2,}|$))/i,
    /huy(?: vao| ngay)?[: ]+([^.]+?)(?=(?:\s{2,}|$))/i,
  ]

  for (const pattern of contextualPatterns) {
    const match = text.match(pattern)
    if (!match) {
      continue
    }

    const candidate = buildRenewalDateMatch(match[1], source, match[0])
    if (candidate) {
      return candidate
    }
  }

  const sentenceCandidates = text
    .split(/(?<=[.!?])\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => renewalKeywordPattern.test(entry))

  for (const sentence of sentenceCandidates) {
    const candidate = buildRenewalDateMatch(sentence, source, sentence)
    if (candidate) {
      return candidate
    }
  }

  return null
}

function extractRenewalDateFromUnknown(
  value: unknown,
  source: string,
  keyTrail: string[] = [],
): RenewalDateMatch | null {
  if (typeof value === 'string') {
    const joinedTrail = keyTrail.join('.')
    if (renewalKeywordPattern.test(joinedTrail) || renewalKeywordPattern.test(value)) {
      return (
        buildRenewalDateMatch(value, source, `${joinedTrail}: ${value}`) ??
        extractRenewalDateFromText(value, source)
      )
    }
    return null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const joinedTrail = keyTrail.join('.')
    if (!renewalKeywordPattern.test(joinedTrail)) {
      return null
    }

    const isoTimestamp = normalizeTimestamp(value)
    if (!isoTimestamp) {
      return null
    }

    return {
      renewalDate: isoTimestamp.slice(0, 10),
      source,
      matchedText: `${joinedTrail}: ${value}`,
    }
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = extractRenewalDateFromUnknown(entry, source, keyTrail)
      if (candidate) {
        return candidate
      }
    }
    return null
  }

  if (!isRecord(value)) {
    return null
  }

  for (const [key, entry] of Object.entries(value)) {
    const candidate = extractRenewalDateFromUnknown(entry, source, [...keyTrail, key])
    if (candidate) {
      return candidate
    }
  }

  return null
}

function extractRenewalDateFromStorageEntries(
  storageEntries: RenewalProbeStorageEntry[],
): RenewalDateMatch | null {
  for (const entry of storageEntries) {
    const keySource = `${entry.scope}:${entry.key}`
    const directTextMatch = extractRenewalDateFromText(entry.value, keySource)
    if (directTextMatch) {
      return directTextMatch
    }

    const parsedValue = parseJsonValue<unknown>(entry.value)
    if (parsedValue !== null) {
      const candidate = extractRenewalDateFromUnknown(parsedValue, keySource, [entry.key])
      if (candidate) {
        return candidate
      }
    }
  }

  return null
}

function asFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) {
      return numeric
    }
  }

  return null
}

function normalizeCodexUsageWindow(value: unknown): CodexUsageWindowSnapshot | null {
  const window = coerceRecord(value)
  const usedPercent = asFiniteNumber(window.used_percent ?? window.usedPercent)
  const windowMinutes = asFiniteNumber(
    window.window_minutes ?? window.windowMinutes,
  )
  const resetsAt = normalizeTimestamp(
    window.resets_at ?? window.reset_at ?? window.resetsAt ?? window.resetAt,
  )

  if (usedPercent === null || windowMinutes === null) {
    return null
  }

  return {
    usedPercent,
    windowMinutes,
    resetsAt,
  }
}

function summarizeUnknownValue(value: unknown) {
  const raw = JSON.stringify(value)
  if (!raw || raw === '{}') {
    return ''
  }

  return raw.length > 160 ? `${raw.slice(0, 157)}...` : raw
}

function summarizeCodexCredits(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value.trim()
  }

  const numericValue = asFiniteNumber(value)
  if (numericValue !== null) {
    return String(numericValue)
  }

  const credits = coerceRecord(value)
  if (Object.keys(credits).length === 0) {
    return ''
  }

  const unit = coerceString(credits.currency ?? credits.unit ?? credits.name).trim()
  const appendUnit = (amount: number) => (unit ? `${amount} ${unit}` : String(amount))
  const remaining = asFiniteNumber(
    credits.remaining ??
      credits.balance ??
      credits.available ??
      credits.remaining_credits ??
      credits.current_balance,
  )
  const used = asFiniteNumber(credits.used ?? credits.consumed ?? credits.spent)
  const total = asFiniteNumber(
    credits.total ?? credits.limit ?? credits.credit_limit ?? credits.max,
  )
  const parts: string[] = []

  if (remaining !== null) {
    parts.push(`Con lai ${appendUnit(remaining)}`)
  }

  if (used !== null) {
    parts.push(`Da dung ${appendUnit(used)}`)
  }

  if (total !== null) {
    parts.push(`Tran ${appendUnit(total)}`)
  }

  if (parts.length > 0) {
    return parts.join(' | ')
  }

  return summarizeUnknownValue(value)
}

function parseCodexUsageFromSessionLine(
  rawLine: string,
  sourcePath: string,
): CodexUsageSnapshot | null {
  const parsed = parseJsonValue<StoredCodexUsageSessionEntry>(rawLine)
  if (!parsed) {
    return null
  }

  const payload = coerceRecord(parsed.payload)
  const rateLimits = coerceRecord(payload.rate_limits)
  const primary = normalizeCodexUsageWindow(rateLimits.primary)
  const secondary = normalizeCodexUsageWindow(rateLimits.secondary)
  const creditsSummary = summarizeCodexCredits(rateLimits.credits)

  if (!primary && !secondary && !creditsSummary) {
    return null
  }

  return {
    lastSyncedAt: '',
    recordedAt: normalizeTimestamp(parsed.timestamp),
    sourcePath,
    planType: coerceString(rateLimits.plan_type).trim(),
    limitReached:
      Boolean(rateLimits.limit_reached) ||
      Boolean(
        (primary && primary.usedPercent >= 100) ||
          (secondary && secondary.usedPercent >= 100),
      ),
    primary,
    secondary,
    creditsSummary,
  }
}

async function collectFilesRecursive(
  rootPath: string,
  extension: string,
): Promise<string[]> {
  try {
    const entries = await readdir(rootPath, { withFileTypes: true })
    const nested: string[][] = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(rootPath, entry.name)

        if (entry.isDirectory()) {
          return await collectFilesRecursive(entryPath, extension)
        }

        if (entry.isFile() && entry.name.endsWith(extension)) {
          return [entryPath]
        }

        return []
      }),
    )

    return nested.flat()
  } catch {
    return [] as string[]
  }
}

async function readMachineCodexUsage(
  payload: CodexUsageReadPayload,
): Promise<CodexUsageReadResult> {
  const sessionsRootPath = path.join(
    getMachineCodexAccountHomePath(payload.accountId),
    'sessions',
  )

  if (!(await pathExists(sessionsRootPath))) {
    return {
      ok: false,
      message:
        'Slot nay chua co log Codex. Mo profile Codex va dung it nhat 1 turn de tao usage log.',
    }
  }

  const sessionFiles = (
    await collectFilesRecursive(sessionsRootPath, '.jsonl')
  ).sort((left: string, right: string) => right.localeCompare(left))

  for (const sessionFilePath of sessionFiles) {
    let raw = ''

    try {
      raw = await readFile(sessionFilePath, 'utf8')
    } catch {
      continue
    }

    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index]
      if (!line.includes('"rate_limits"')) {
        continue
      }

      const usage = parseCodexUsageFromSessionLine(line, sessionFilePath)
      if (!usage) {
        continue
      }

      return {
        ok: true,
        usage: {
          ...usage,
          lastSyncedAt: new Date().toISOString(),
        },
        message: 'Da doc usage Codex tu log local cua slot nay.',
      }
    }
  }

  return {
    ok: false,
    message:
      'Khong tim thay du lieu rate limit trong log Codex. Thu mo profile Codex va chay them mot turn roi sync lai.',
  }
}

function normalizeBackupMessage(nodeKey: string, value: unknown) {
  const node = coerceRecord(value)
  const message = coerceRecord(node.message)
  const author = coerceRecord(message.author)
  const content = message.content ?? node.content
  const text = normalizeMessageText(content)

  if (!text) {
    return null
  }

  return {
    id: coerceString(message.id).trim() || nodeKey,
    author:
      coerceString(author.role).trim() ||
      coerceString(author.name).trim() ||
      'unknown',
    createdAt: normalizeTimestamp(message.create_time ?? node.create_time),
    text,
  } satisfies ChatBackupConversationMessage
}

function normalizeBackupConversation(value: unknown) {
  const conversation = coerceRecord(value)
  const mapping = coerceRecord(conversation.mapping)
  const dedupedMessages = new Map<string, ChatBackupConversationMessage>()

  Object.entries(mapping).forEach(([nodeKey, nodeValue]) => {
    const normalized = normalizeBackupMessage(nodeKey, nodeValue)

    if (!normalized || dedupedMessages.has(normalized.id)) {
      return
    }

    dedupedMessages.set(normalized.id, normalized)
  })

  const messages = Array.from(dedupedMessages.values()).sort((left, right) => {
    if (!left.createdAt && !right.createdAt) {
      return 0
    }

    if (!left.createdAt) {
      return 1
    }

    if (!right.createdAt) {
      return -1
    }

    return left.createdAt.localeCompare(right.createdAt)
  })

  if (messages.length === 0) {
    return null
  }

  const participants = Array.from(
    new Set(messages.map((message) => message.author).filter(Boolean)),
  )
  const title = coerceString(conversation.title).trim() || 'Untitled chat'
  const createdAt =
    normalizeTimestamp(conversation.create_time) || messages[0]?.createdAt || ''
  const updatedAt =
    normalizeTimestamp(conversation.update_time) ||
    messages[messages.length - 1]?.createdAt ||
    createdAt
  const preview = messages
    .map((message) => message.text.trim())
    .find(Boolean)
    ?.slice(0, 280) ?? ''

  return {
    id: coerceString(conversation.id).trim() || createLocalId('backup-conv'),
    title,
    createdAt,
    updatedAt,
    messageCount: messages.length,
    participants,
    preview,
    messages,
  } satisfies ChatBackupConversation
}

async function parseChatBackupSourceFile(sourceFilePath: string) {
  const extension = path.extname(sourceFilePath).toLowerCase()
  const rawBuffer = await readFile(sourceFilePath)
  let rawJson = ''

  if (extension === '.zip') {
    const archive = await JSZip.loadAsync(rawBuffer)
    const conversationsEntry = Object.values(archive.files).find(
      (entry) =>
        !entry.dir &&
        (
          entry.name.toLowerCase().endsWith('/conversations.json') ||
          entry.name.toLowerCase() === 'conversations.json'
        ),
    )

    if (!conversationsEntry) {
      throw new Error('Khong tim thay conversations.json trong file export ZIP.')
    }

    rawJson = await conversationsEntry.async('string')
  } else {
    rawJson = rawBuffer.toString('utf8')
  }

  const parsed = parseJsonValue<unknown>(rawJson)
  const conversationsSource = Array.isArray(parsed)
    ? parsed
    : Array.isArray(coerceRecord(parsed).conversations)
      ? (coerceRecord(parsed).conversations as unknown[])
      : null

  if (!conversationsSource) {
    throw new Error('File da chon khong phai conversations.json hop le.')
  }

  const conversations = conversationsSource
    .map((conversation) => normalizeBackupConversation(conversation))
    .filter((conversation): conversation is ChatBackupConversation => Boolean(conversation))
    .sort((left, right) => compareIsoDates(left.updatedAt, right.updatedAt))

  const messageCount = conversations.reduce(
    (sum, conversation) => sum + conversation.messageCount,
    0,
  )

  return {
    conversations,
    conversationCount: conversations.length,
    messageCount,
    firstConversationAt:
      [...conversations]
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0]?.createdAt ||
      '',
    lastConversationAt: conversations[0]?.updatedAt || '',
  }
}

async function importChatBackup(payload: ChatBackupImportPayload) {
  const selection = await dialog.showOpenDialog({
    title: 'Import ChatGPT export',
    filters: [
      { name: 'ChatGPT export', extensions: ['zip', 'json'] },
      { name: 'ZIP', extensions: ['zip'] },
      { name: 'JSON', extensions: ['json'] },
    ],
    properties: ['openFile'],
  })

  if (selection.canceled || selection.filePaths.length === 0) {
    return {
      ok: false,
    }
  }

  const sourceFilePath = selection.filePaths[0]
  const parsed = await parseChatBackupSourceFile(sourceFilePath)
  const backupId = createLocalId('backup')
  const backup: ChatBackupRecord = {
    id: backupId,
    accountId: payload.accountId,
    sourceFileName: path.basename(sourceFilePath),
    sourceFilePath,
    importedAt: new Date().toISOString(),
    conversationCount: parsed.conversationCount,
    messageCount: parsed.messageCount,
    firstConversationAt: parsed.firstConversationAt,
    lastConversationAt: parsed.lastConversationAt,
    titleSamples: parsed.conversations
      .map((conversation) => conversation.title)
      .filter(Boolean)
      .slice(0, 4),
  }
  const storagePath = getChatBackupStoragePath(payload.accountId, backupId)

  await mkdir(path.dirname(storagePath), { recursive: true })
  await writeFile(
    storagePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        backup,
        conversations: parsed.conversations,
      } satisfies StoredChatBackupFile,
      null,
      2,
    ),
    'utf8',
  )

  return {
    ok: true,
    backup,
    message:
      parsed.conversationCount > 0
        ? `Da import ${parsed.conversationCount} cuoc tro chuyen vao kho backup local.`
        : 'Da import file backup, nhung chua tim thay cuoc tro chuyen hop le.',
  }
}

async function readChatBackup(payload: ChatBackupReadPayload) {
  if (!payload.accountId?.trim()) {
    return {
      ok: false,
      message: 'Khong xac dinh duoc slot cua backup da chon.',
    }
  }

  const storagePath = getChatBackupStoragePath(payload.accountId, payload.backupId)

  if (!(await pathExists(storagePath))) {
    return {
      ok: false,
      message: 'Khong tim thay file backup da xu ly tren o dia.',
    }
  }

  const raw = await readFile(storagePath, 'utf8')
  const parsed = parseJsonValue<StoredChatBackupFile>(raw)

  if (!parsed) {
    return {
      ok: false,
      message: 'Khong doc duoc file backup da xu ly.',
    }
  }

  return {
    ok: true,
    backup: parsed.backup,
    conversations: parsed.conversations,
  }
}

function normalizePlanCandidate(raw: string, path = '') {
  const value = raw.trim().toLowerCase()
  const keyPath = path.toLowerCase()

  if (!value) {
    return ''
  }

  if (value.includes('enterprise')) {
    return 'Enterprise'
  }

  if (value.includes('business') || value.includes('team')) {
    return 'Business'
  }

  if (
    /\bpro\b/.test(value) ||
    value.includes('chatgptpro') ||
    value.includes('chatgpt pro')
  ) {
    return 'Pro'
  }

  if (
    value.includes('plus') ||
    value.includes('chatgptplus') ||
    value.includes('chatgpt plus') ||
    (value.includes('paid') &&
      /(plan|subscription|workspace|tier|account)/.test(keyPath))
  ) {
    return 'Plus'
  }

  return ''
}

function planScore(plan: string) {
  switch (plan) {
    case 'Enterprise':
      return 4
    case 'Business':
      return 3
    case 'Pro':
      return 2
    case 'Plus':
      return 1
    default:
      return 0
  }
}

function pickBetterPlan(currentPlan: string, nextPlan: string) {
  return planScore(nextPlan) > planScore(currentPlan) ? nextPlan : currentPlan
}

function walkUnknown(
  value: unknown,
  visitor: (value: unknown, path: string[]) => void,
  path: string[] = [],
  seen = new Set<unknown>(),
) {
  visitor(value, path)

  if (value === null || typeof value !== 'object') {
    return
  }

  if (seen.has(value)) {
    return
  }

  seen.add(value)

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      walkUnknown(entry, visitor, [...path, String(index)], seen)
    })
    return
  }

  Object.entries(value).forEach(([key, entry]) => {
    walkUnknown(entry, visitor, [...path, key], seen)
  })
}

function detectPlanFromUnknown(value: unknown) {
  let detectedPlan = ''

  walkUnknown(value, (node, path) => {
    const pathLabel = path.join('.').toLowerCase()

    if (typeof node === 'boolean' && node && pathLabel.includes('is_paid')) {
      detectedPlan = pickBetterPlan(detectedPlan, 'Plus')
      return
    }

    if (typeof node !== 'string') {
      return
    }

    const keyLooksRelevant =
      /(plan|subscription|tier|workspace|product)/.test(pathLabel) ||
      path.length === 0

    if (!keyLooksRelevant) {
      return
    }

    detectedPlan = pickBetterPlan(
      detectedPlan,
      normalizePlanCandidate(node, pathLabel),
    )
  })

  return detectedPlan
}

function detectWorkspaceName(value: unknown) {
  let workspaceName = ''

  walkUnknown(value, (node, path) => {
    if (workspaceName || typeof node !== 'string') {
      return
    }

    const lastKey = path[path.length - 1]?.toLowerCase() ?? ''
    const parentKey = path[path.length - 2]?.toLowerCase() ?? ''
    if (
      lastKey === 'workspace_name' ||
      (lastKey === 'name' &&
        (parentKey.includes('workspace') || path.join('.').includes('workspace')))
    ) {
      workspaceName = node.trim()
    }
  })

  return workspaceName
}

function readCookieProfile(cookies: Electron.Cookie[]) {
  const rawCookie = cookies.find(
    (cookie) =>
      cookie.name === 'oai-client-auth-info' &&
      (cookie.domain ?? '').includes('chatgpt.com'),
  )?.value

  if (!rawCookie) {
    return {
      name: '',
      email: '',
      imageUrl: '',
      authenticated: false,
    }
  }

  const parsed = parseJsonValue<{
    user?: {
      name?: string
      email?: string
      picture?: string
      image?: string
    }
  }>(decodeCookieValue(rawCookie))

  const user = isRecord(parsed?.user) ? parsed.user : null

  return {
    name: asString(user?.name),
    email: asString(user?.email),
    imageUrl: asString(user?.image) || asString(user?.picture),
    authenticated: Boolean(asString(user?.email) || asString(user?.name)),
  }
}

function profileFromAuthSession(body: unknown) {
  if (!isRecord(body)) {
    return {
      name: '',
      email: '',
      imageUrl: '',
      authenticated: false,
    }
  }

  const user = isRecord(body.user) ? body.user : null

  return {
    name: asString(user?.name),
    email: asString(user?.email),
    imageUrl: asString(user?.image) || asString(user?.picture),
    authenticated: Boolean(asString(user?.email) || asString(user?.name)),
  }
}

async function parseResponseBody(response: Response) {
  const bodyText = await response.text()
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return parseJsonValue<unknown>(bodyText) ?? bodyText
  }

  return bodyText
}

async function probeSessionViaFetch(accountSession: Electron.Session) {
  const sessionWithFetch = accountSession as Electron.Session & {
    fetch?: (input: string, init?: RequestInit) => Promise<Response>
  }

  if (!sessionWithFetch.fetch) {
    return {} as Record<string, EndpointProbe>
  }

  const endpointResults: Record<string, EndpointProbe> = {}

  for (const url of syncProbeUrls) {
    try {
      const response = await sessionWithFetch.fetch(url, {
        headers: {
          accept: 'application/json, text/plain, */*',
        },
      })

      endpointResults[url] = {
        ok: response.ok,
        status: response.status,
        body: await parseResponseBody(response),
      }
    } catch (error) {
      endpointResults[url] = {
        ok: false,
        status: 0,
        error:
          error instanceof Error ? error.message : 'Khong doc duoc endpoint.',
      }
    }
  }

  return endpointResults
}

async function probeSessionViaWindow(partition: string, startUrl: string) {
  const probeWindow = new BrowserWindow({
    show: false,
    width: 1320,
    height: 920,
    autoHideMenuBar: true,
    backgroundColor: '#f4efe7',
    ...getBrowserWindowIconOptions(),
    webPreferences: {
      partition,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  probeWindow.webContents.setWindowOpenHandler(() => ({
    action: 'deny',
  }))

  try {
    await probeWindow.loadURL(startUrl)

    const snapshot = await probeWindow.webContents.executeJavaScript(`
      (async () => {
        const endpoints = ${JSON.stringify(syncProbeUrls)};
        const endpointResults = {};

        for (const url of endpoints) {
          try {
            const response = await fetch(url, {
              credentials: 'include',
              headers: {
                accept: 'application/json, text/plain, */*',
              },
              cache: 'no-store',
            })

            const text = await response.text()
            let body = text

            try {
              body = JSON.parse(text)
            } catch {}

            endpointResults[url] = {
              ok: response.ok,
              status: response.status,
              body,
            }
          } catch (error) {
            endpointResults[url] = {
              ok: false,
              status: 0,
              error: error instanceof Error ? error.message : String(error),
            }
          }
        }

        const storageEntries = []
        try {
          for (let index = 0; index < window.localStorage.length; index += 1) {
            const key = window.localStorage.key(index)
            if (!key || !/(plan|subscription|workspace|account|entitlement)/i.test(key)) {
              continue
            }

            storageEntries.push({
              key,
              value: window.localStorage.getItem(key) ?? '',
            })
          }
        } catch {}

        return {
          url: window.location.href,
          title: document.title,
          endpoints: endpointResults,
          storageEntries,
        }
      })()
    `)

    return snapshot as ProbeWindowSnapshot
  } finally {
    if (!probeWindow.isDestroyed()) {
      probeWindow.destroy()
    }
  }
}

async function captureRenewalProbeSnapshot(
  probeWindow: BrowserWindow,
): Promise<RenewalProbeSnapshot> {
  return (await probeWindow.webContents.executeJavaScript(`
    (() => {
      const keyPattern = /(plan|subscription|workspace|account|entitlement|billing|payment|invoice|renew|expire|cancel)/i
      const collectStorageEntries = (storage, scope) => {
        const entries = []
        try {
          for (let index = 0; index < storage.length; index += 1) {
            const key = storage.key(index)
            if (!key || !keyPattern.test(key)) {
              continue
            }

            entries.push({
              scope,
              key,
              value: storage.getItem(key) ?? '',
            })
          }
        } catch {}
        return entries
      }

      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body?.innerText ?? '',
        storageEntries: [
          ...collectStorageEntries(window.localStorage, 'localStorage'),
          ...collectStorageEntries(window.sessionStorage, 'sessionStorage'),
        ],
      }
    })()
  `)) as RenewalProbeSnapshot
}

function isAuthenticatedRenewalSnapshot(snapshot: RenewalProbeSnapshot) {
  const haystack = `${snapshot.url}\n${snapshot.title}\n${snapshot.bodyText}`.toLowerCase()
  if (
    snapshot.url.includes('/auth/') ||
    snapshot.url.includes('/login') ||
    haystack.includes('log in') ||
    haystack.includes('sign up') ||
    haystack.includes('continue with google') ||
    haystack.includes('continue with apple')
  ) {
    return false
  }

  return true
}

function extractRenewalDateFromSnapshot(
  snapshot: RenewalProbeSnapshot,
): RenewalDateMatch | null {
  return (
    extractRenewalDateFromText(snapshot.bodyText, `dom:${snapshot.url}`) ??
    extractRenewalDateFromStorageEntries(snapshot.storageEntries)
  )
}

async function clickRenewalProbeTarget(
  probeWindow: BrowserWindow,
  keywords: string[],
) {
  const result = await probeWindow.webContents.executeJavaScript(`
    (() => {
      const keywords = ${JSON.stringify(keywords.map((keyword) => keyword.toLowerCase()))}
      const normalize = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim().toLowerCase()
      const selectors = 'button, a, [role="button"], [data-testid]'
      const candidates = Array.from(document.querySelectorAll(selectors))
        .map((element) => {
          const text = normalize(element.innerText || element.textContent)
          const aria = normalize(element.getAttribute('aria-label'))
          const title = normalize(element.getAttribute('title'))
          const dataTestId = normalize(element.getAttribute('data-testid'))
          const searchText = [text, aria, title, dataTestId].filter(Boolean).join(' | ')
          if (!searchText) {
            return null
          }

          let score = 0
          for (const keyword of keywords) {
            if (text === keyword || aria === keyword || title === keyword) {
              score += 100
            } else if (searchText.includes(keyword)) {
              score += 10
            }
          }

          if (score === 0) {
            return null
          }

          return {
            element,
            score,
            text: text || aria || title || dataTestId,
          }
        })
        .filter(Boolean)
        .sort((left, right) => {
          if (right.score !== left.score) {
            return right.score - left.score
          }

          return left.text.length - right.text.length
        })

      const best = candidates[0]
      if (!best) {
        return { clicked: false }
      }

      best.element.scrollIntoView({ block: 'center', inline: 'center' })
      best.element.click()
      best.element.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      )

      return {
        clicked: true,
        text: best.text,
      }
    })()
  `)

  return result as { clicked: boolean; text?: string }
}

async function waitForRenewalProbeWindow(probeWindow: BrowserWindow, ms = 1800) {
  await delay(ms)

  if (probeWindow.webContents.isLoading()) {
    try {
      await probeWindow.webContents.executeJavaScript('document.readyState')
    } catch {
      await delay(1200)
    }
  }
}

async function loadRenewalProbeTarget(
  probeWindow: BrowserWindow,
  targetUrl: string,
) {
  const parsedTarget = new URL(targetUrl)

  if (
    parsedTarget.hostname.endsWith('chatgpt.com') &&
    parsedTarget.hash.startsWith('#settings/')
  ) {
    await probeWindow.loadURL(`${parsedTarget.origin}/`)
    await waitForRenewalProbeWindow(probeWindow, 2200)

    await probeWindow.webContents.executeJavaScript(`
      (() => {
        const targetHash = ${JSON.stringify(parsedTarget.hash)}
        if (window.location.hash !== targetHash) {
          window.location.hash = targetHash
          window.dispatchEvent(new HashChangeEvent('hashchange', {
            oldURL: window.location.href,
            newURL: window.location.origin + '/' + targetHash,
          }))
        }
      })()
    `)
    await waitForRenewalProbeWindow(probeWindow, 2400)
    return
  }

  await probeWindow.loadURL(targetUrl)
  await waitForRenewalProbeWindow(probeWindow, 2400)
}

async function retryRenewalProbeInVisibleWindow(
  probeWindow: BrowserWindow,
  targetUrl: string,
) {
  probeWindow.show()
  probeWindow.focus()
  await loadRenewalProbeTarget(probeWindow, targetUrl)

  let snapshot = await captureRenewalProbeSnapshot(probeWindow)
  let match = extractRenewalDateFromSnapshot(snapshot)

  if (match) {
    return match
  }

  const visibleClickSequences = [
    ['account'],
    ['billing and payments'],
    ['billing', 'payment', 'subscription'],
  ]

  for (const keywords of visibleClickSequences) {
    const clickResult = await clickRenewalProbeTarget(probeWindow, keywords)
    if (!clickResult.clicked) {
      continue
    }

    await waitForRenewalProbeWindow(probeWindow, 2000)
    snapshot = await captureRenewalProbeSnapshot(probeWindow)
    match = extractRenewalDateFromSnapshot(snapshot)

    if (match) {
      return match
    }
  }

  return null
}

async function readAccountRenewalDate(
  payload: RenewalDateReadPayload,
): Promise<RenewalDateReadResult> {
  const partition = getAccountPartition(payload.accountId)
  const targetUrl = normalizeStartUrl(
    payload.startUrl ?? 'https://chatgpt.com/#settings/Account',
  )
  const popupUrls: string[] = []
  const probeWindow = new BrowserWindow({
    show: false,
    width: 1320,
    height: 920,
    autoHideMenuBar: true,
    backgroundColor: '#f4efe7',
    paintWhenInitiallyHidden: true,
    ...getBrowserWindowIconOptions(),
    webPreferences: {
      partition,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })

  probeWindow.webContents.setWindowOpenHandler(({ url }) => {
    popupUrls.push(url)
    void probeWindow.loadURL(url)
    return { action: 'deny' }
  })

  try {
    await loadRenewalProbeTarget(probeWindow, targetUrl)

    let snapshot = await captureRenewalProbeSnapshot(probeWindow)
    let match = extractRenewalDateFromSnapshot(snapshot)

    if (match) {
      return {
        ok: true,
        partition,
        targetUrl,
        authenticated: true,
        renewalDate: match.renewalDate,
        source: match.source,
        matchedText: match.matchedText,
        message: `Da doc duoc renewal date tu ${match.source}.`,
      }
    }

    const authenticated = isAuthenticatedRenewalSnapshot(snapshot)
    if (!authenticated) {
      return {
        ok: false,
        partition,
        targetUrl,
        authenticated: false,
        message:
          'Session nay chua dang nhap hop le. Mo session, dang nhap xong roi bam Sync gia han lai.',
      }
    }

    const clickSequences = [
      ['settings'],
      ['account'],
      ['billing and payments'],
      ['billing', 'payment', 'subscription'],
      ['manage subscription', 'manage payment'],
    ]

    for (const keywords of clickSequences) {
      const clickResult = await clickRenewalProbeTarget(probeWindow, keywords)
      if (!clickResult.clicked) {
        continue
      }

      await waitForRenewalProbeWindow(
        probeWindow,
        keywords.includes('manage subscription') ? 3000 : 1800,
      )

      snapshot = await captureRenewalProbeSnapshot(probeWindow)
      match = extractRenewalDateFromSnapshot(snapshot)

      if (match) {
        const source = popupUrls.length
          ? `${match.source} -> ${popupUrls[popupUrls.length - 1]}`
          : match.source
        return {
          ok: true,
          partition,
          targetUrl,
          authenticated: true,
          renewalDate: match.renewalDate,
          source,
          matchedText: match.matchedText,
          message: `Da doc duoc renewal date tu ${source}.`,
        }
      }
    }

    const visibleMatch = await retryRenewalProbeInVisibleWindow(
      probeWindow,
      targetUrl,
    )

    if (visibleMatch) {
      return {
        ok: true,
        partition,
        targetUrl,
        authenticated: true,
        renewalDate: visibleMatch.renewalDate,
        source: `${visibleMatch.source} -> visible-window`,
        matchedText: visibleMatch.matchedText,
        message: `Da doc duoc renewal date sau khi mo cua so Account.`,
      }
    }

    return {
      ok: false,
      partition,
      targetUrl,
      authenticated: true,
      message:
        `Khong tu dong doc duoc renewal date. Probe dang thay URL ${snapshot.url || targetUrl} va title "${snapshot.title || 'Khong co'}". Preview: ${normalizeVisibleText(snapshot.bodyText).slice(0, 180) || 'Khong co text'}`,
    }
  } finally {
    if (!probeWindow.isDestroyed()) {
      probeWindow.destroy()
    }
  }
}

function buildSessionProfile(
  targetUrl: string,
  cookieProfile: ReturnType<typeof readCookieProfile>,
  endpointResults: Record<string, EndpointProbe>,
  probeWindowSnapshot?: ProbeWindowSnapshot,
): SessionProfileSnapshot {
  const authSessionBody = endpointResults['https://chatgpt.com/api/auth/session']?.body
  const authSessionProfile = profileFromAuthSession(authSessionBody)
  let plan = ''
  let workspaceName = ''

  Object.values(endpointResults).forEach((result) => {
    plan = pickBetterPlan(plan, detectPlanFromUnknown(result.body))
    workspaceName = workspaceName || detectWorkspaceName(result.body)
  })

  probeWindowSnapshot?.storageEntries.forEach((entry) => {
    plan = pickBetterPlan(
      plan,
      detectPlanFromUnknown(parseJsonValue(entry.value) ?? entry.value),
    )
  })

  if (probeWindowSnapshot) {
    Object.values(probeWindowSnapshot.endpoints).forEach((result) => {
      plan = pickBetterPlan(plan, detectPlanFromUnknown(result.body))
      workspaceName = workspaceName || detectWorkspaceName(result.body)
    })
  }

  const authenticated =
    authSessionProfile.authenticated ||
    cookieProfile.authenticated ||
    Boolean(
      probeWindowSnapshot &&
        !probeWindowSnapshot.url.includes('/auth/') &&
        !probeWindowSnapshot.url.includes('/logout'),
    )

  return {
    authenticated,
    name: authSessionProfile.name || cookieProfile.name,
    email: authSessionProfile.email || cookieProfile.email,
    imageUrl: authSessionProfile.imageUrl || cookieProfile.imageUrl,
    plan,
    workspaceName,
    targetUrl: probeWindowSnapshot?.url || targetUrl,
    lastSyncedAt: new Date().toISOString(),
  }
}

async function syncAccountSession(payload: SyncAccountSessionPayload) {
  const partition = getAccountPartition(payload.accountId)
  const targetUrl = normalizeStartUrl(payload.startUrl ?? 'https://chatgpt.com/')
  const accountSession = session.fromPartition(partition)
  const cookies = await accountSession.cookies.get({})
  const cookieProfile = readCookieProfile(cookies)
  const endpointResults = await probeSessionViaFetch(accountSession)
  let probeWindowSnapshot: ProbeWindowSnapshot | undefined
  let profile = buildSessionProfile(
    targetUrl,
    cookieProfile,
    endpointResults,
  )

  if (!profile.plan || !profile.authenticated) {
    probeWindowSnapshot = await probeSessionViaWindow(partition, targetUrl)
    profile = buildSessionProfile(
      targetUrl,
      cookieProfile,
      endpointResults,
      probeWindowSnapshot,
    )
  }

  return {
    ok: true,
    partition,
    profile,
    message: profile.authenticated
      ? profile.plan
        ? `Da dong bo session, nhan dien goi ${profile.plan}.`
        : 'Da dong bo session, da cap nhat thong tin tai khoan.'
      : 'Session nay chua dang nhap hop le. Mo session, dang nhap xong roi bam Sync lai.',
  }
}

async function captureMachineCodexAuth(payload: SessionActionPayload) {
  const slotAuthPath = getMachineCodexSnapshotPath(payload.accountId)
  const accountHomePath = getMachineCodexAccountHomePath(payload.accountId)

  if (!(await pathExists(slotAuthPath))) {
    return {
      ok: false,
      authPath: slotAuthPath,
      snapshotPath: accountHomePath,
      profileExists: false,
      message:
        'Slot nay chua co profile Codex rieng. Bam Mo profile Codex de mo dung slot, dang nhap 1 lan, roi quay lai bam Kiem tra profile.',
    }
  }

  const snapshot = await readMachineCodexAuthSnapshot(slotAuthPath)

  return {
    ok: true,
    authPath: slotAuthPath,
    snapshotPath: slotAuthPath,
    snapshotAccountId: snapshot?.accountId ?? '',
    profileExists: true,
    message:
      snapshot?.accountId
        ? 'Da tim thay profile Codex rieng cua slot nay.'
        : 'Da tim thay profile Codex rieng cua slot nay, nhung chua doc duoc account_id. Neu ban vua dang nhap xong, bam Kiem tra profile lai.',
  }
}

async function relaunchMachineCodex(accountId: string, workspacePath?: string) {
  await stopCodexDesktop()

  const codexExecutable = await resolveCodexExecutable()
  const args = ['app']
  const codexHomePath = getMachineCodexAccountHomePath(accountId)

  await mkdir(codexHomePath, { recursive: true, mode: 0o700 })

  if (workspacePath?.trim()) {
    args.push(workspacePath.trim())
  }

  await spawnDetached(codexExecutable, args, {
    CODEX_HOME: codexHomePath,
  })

  if (process.platform === 'darwin') {
    await delay(1200)
    await runBestEffort('osascript', ['-e', 'tell application "Codex" to activate'])
  }
}

async function findReusableMachineCodexAuth(
  targetAccountId: string,
  desiredEmail: string,
) {
  const normalizedEmail = desiredEmail.trim().toLowerCase()

  if (!normalizedEmail) {
    return null
  }

  const candidatePaths = [getGlobalCodexAuthPath()]

  try {
    const slotIds = await readdir(getMachineCodexRootPath())
    slotIds
      .filter((slotId) => slotId !== targetAccountId)
      .forEach((slotId) => {
        candidatePaths.push(getMachineCodexSnapshotPath(slotId))
      })
  } catch {
    // Ignore missing snapshot directories while scanning auth candidates.
  }

  for (const candidatePath of candidatePaths) {
    if (!(await pathExists(candidatePath))) {
      continue
    }

    const identity = await readMachineCodexAuthIdentity(candidatePath)

    if (!identity?.email || identity.email.trim().toLowerCase() !== normalizedEmail) {
      continue
    }

    return {
      ...identity,
      authPath: candidatePath,
    }
  }

  return null
}

function extractAuthUrlFromText(rawText: string) {
  const match = rawText.match(/https:\/\/auth\.openai\.com\/oauth\/authorize\?[^\s]+/)
  return match?.[0] ?? ''
}

async function startMachineCodexLogin(
  payload: MachineCodexPayload,
  authWindowPayload: OpenAccountSessionPayload,
) {
  const existingTask = machineCodexLoginTasks.get(payload.accountId)

  if (existingTask) {
    await openCodexWindowForAccount({
      ...authWindowPayload,
      startUrl: existingTask.authUrl,
    })

    return {
      ok: true,
      authPath: getMachineCodexSnapshotPath(payload.accountId),
      snapshotPath: getMachineCodexAccountHomePath(payload.accountId),
      workspacePath: payload.workspacePath?.trim() || '',
      profileExists: false,
      switched: false,
      loginInitiated: true,
      message:
        'Dang cho uy quyen Codex trong cua so cua app. Hoan tat dang nhap trong cua so do; Codex Desktop se tu mo lai sau khi xong.',
    }
  }

  const codexExecutable = await resolveCodexExecutable()
  const codexHomePath = getMachineCodexAccountHomePath(payload.accountId)
  const snapshotPath = getMachineCodexSnapshotPath(payload.accountId)
  await mkdir(codexHomePath, { recursive: true, mode: 0o700 })

  const authUrl = await new Promise<string>((resolve, reject) => {
    const child = spawn(codexExecutable, ['login'], {
      env: {
        ...process.env,
        CODEX_HOME: codexHomePath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let outputBuffer = ''
    let settled = false

    const settle = (callback: () => void) => {
      if (settled) {
        return
      }

      settled = true
      callback()
    }

    const handleChunk = (chunk: Buffer | string) => {
      outputBuffer += chunk.toString()
      const nextAuthUrl = extractAuthUrlFromText(outputBuffer)

      if (!nextAuthUrl) {
        return
      }

      machineCodexLoginTasks.set(payload.accountId, {
        authUrl: nextAuthUrl,
        child,
      })

      settle(() => resolve(nextAuthUrl))
    }

    child.stdout?.on('data', handleChunk)
    child.stderr?.on('data', handleChunk)

    child.once('error', (error) => {
      machineCodexLoginTasks.delete(payload.accountId)
      settle(() => reject(error))
    })

    child.once('close', () => {
      machineCodexLoginTasks.delete(payload.accountId)

      void (async () => {
        if (await pathExists(snapshotPath)) {
          await relaunchMachineCodex(payload.accountId, payload.workspacePath)
        }
      })()

      const message = outputBuffer.trim() || 'Khong tao duoc phien uy quyen Codex.'
      settle(() => reject(new Error(message)))
    })

    setTimeout(() => {
      if (settled) {
        return
      }

      child.kill('SIGTERM')
      settle(() =>
        reject(
          new Error(
            'Khong lay duoc URL uy quyen Codex tu local login server.',
          ),
        ),
      )
    }, 10000)
  })

  await openCodexWindowForAccount({
    ...authWindowPayload,
    startUrl: authUrl,
  })

  return {
    ok: true,
    authPath: snapshotPath,
    snapshotPath: codexHomePath,
    workspacePath: payload.workspacePath?.trim() || '',
    profileExists: false,
    switched: false,
    loginInitiated: true,
    message:
      'Da mo cua so uy quyen Codex theo session cua slot nay. Hoan tat dang nhap trong cua so do; Codex Desktop se tu mo lai sau khi xong.',
  }
}

async function switchMachineCodexAuth(payload: MachineCodexPayload) {
  const accountHomePath = getMachineCodexAccountHomePath(payload.accountId)
  const snapshotPath = getMachineCodexSnapshotPath(payload.accountId)
  const slotAuthExists = await pathExists(snapshotPath)
  const targetSnapshot = await readMachineCodexAuthSnapshot(snapshotPath)

  if (!slotAuthExists) {
    const partition = getAccountPartition(payload.accountId)
    const accountSession = session.fromPartition(partition)
    const cookies = await accountSession.cookies.get({})
    const authInfoCookie = cookies.find(
      (cookie) => cookie.name === 'oai-client-auth-info',
    )
    const sessionEmail = authInfoCookie
      ? extractEmailFromEncodedAuthInfo(authInfoCookie.value)
      : ''
    const reusableAuth = await findReusableMachineCodexAuth(
      payload.accountId,
      sessionEmail || payload.email || '',
    )

    if (reusableAuth) {
      await mkdir(accountHomePath, { recursive: true, mode: 0o700 })
      await copyFile(reusableAuth.authPath, snapshotPath)

      if (payload.relaunch ?? true) {
        await relaunchMachineCodex(payload.accountId, payload.workspacePath)
      }

      return {
        ok: true,
        authPath: snapshotPath,
        snapshotPath,
        workspacePath: payload.workspacePath?.trim() || '',
        snapshotAccountId: reusableAuth.accountId,
        profileExists: true,
        switched: true,
        message: reusableAuth.name
          ? `Da ap dung profile Codex da luu san cho ${reusableAuth.name}.`
          : `Da ap dung profile Codex da luu san cho ${reusableAuth.email}.`,
      }
    }

    return await startMachineCodexLogin(payload, {
      accountId: payload.accountId,
      label: payload.label?.trim() || payload.accountId,
      startUrl: 'https://chatgpt.com/',
    })
  }

  if (payload.relaunch ?? true) {
    await relaunchMachineCodex(payload.accountId, payload.workspacePath)
  }

  return {
    ok: true,
    authPath: snapshotPath,
    snapshotPath: slotAuthExists ? snapshotPath : accountHomePath,
    workspacePath: payload.workspacePath?.trim() || '',
    snapshotAccountId: targetSnapshot?.accountId ?? '',
    profileExists: slotAuthExists,
    switched: true,
    message:
      targetSnapshot?.accountId
        ? 'Da mo Codex voi profile rieng cua slot nay.'
        : slotAuthExists
          ? 'Da mo Codex voi profile rieng cua slot nay. Neu can, bam Kiem tra profile de cap nhat thong tin nhan dien.'
          : 'Slot nay chua co profile Codex rieng. Da mo Codex voi home rieng cua slot; dang nhap account nay 1 lan, roi bam Kiem tra profile de xac nhan.',
  }
}

async function diagnoseCodexAuth(payload: DiagnoseCodexAuthPayload) {
  const partition = getAccountPartition(payload.accountId)
  const slotAuthPath = getMachineCodexSnapshotPath(payload.accountId)
  const slotSnapshot = await readMachineCodexAuthSnapshot(slotAuthPath)
  const slotAuthExists = await pathExists(slotAuthPath)
  const accountSession = session.fromPartition(partition)
  const cookies = await accountSession.cookies.get({})
  const puidCookie = cookies.find((cookie) => cookie.name === '_puid')
  const authInfoCookie = cookies.find(
    (cookie) => cookie.name === 'oai-client-auth-info',
  )
  const sessionEmail = authInfoCookie
    ? extractEmailFromEncodedAuthInfo(authInfoCookie.value)
    : ''

  return {
    ok: true,
    partition,
    slotAuthPath,
    slotAuthExists,
    slotAccountId: slotSnapshot?.accountId ?? '',
    sessionPuid: puidCookie?.value ?? '',
    sessionEmail,
  }
}

function getDataFilePath() {
  return path.join(app.getPath('userData'), dataFileName)
}

async function readPersistedState() {
  const dataFilePath = getDataFilePath()

  try {
    const raw = await readFile(dataFilePath, 'utf8')
    return sanitizeState(JSON.parse(raw))
  } catch {
    const nextState = createInitialState()
    await persistState(nextState)
    return nextState
  }
}

async function persistState(state: AppState) {
  const dataFilePath = getDataFilePath()
  await mkdir(path.dirname(dataFilePath), { recursive: true })
  await writeFile(dataFilePath, JSON.stringify(state, null, 2), 'utf8')
}

function normalizeStartUrl(rawUrl: string) {
  const candidate = rawUrl.trim() || 'https://chatgpt.com/'

  try {
    return new URL(candidate).toString()
  } catch {
    return new URL(`https://${candidate}`).toString()
  }
}

function isManagedOpenAiUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl)
    return (
      parsed.hostname.endsWith('chatgpt.com') ||
      parsed.hostname.endsWith('openai.com') ||
      parsed.hostname.endsWith('oaistatic.com') ||
      parsed.hostname.endsWith('oaiusercontent.com')
    )
  } catch {
    return false
  }
}

function wireManagedWindow(
  managedWindow: BrowserWindow,
  payload: OpenAccountSessionPayload,
  kind: 'Session' | 'Codex',
) {
  managedWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isManagedOpenAiUrl(url)) {
      void managedWindow.loadURL(url)
      return { action: 'deny' }
    }

    void shell.openExternal(url)
    return { action: 'deny' }
  })

  managedWindow.webContents.on('will-navigate', (_event, url) => {
    try {
      managedWindow.setTitle(`${payload.label} · ${kind} · ${new URL(url).pathname}`)
    } catch {
      managedWindow.setTitle(`${payload.label} · ${kind}`)
    }
  })
}

async function openAccountSessionWindow(payload: OpenAccountSessionPayload) {
  const partition = getAccountPartition(payload.accountId)
  const targetUrl = normalizeStartUrl(payload.startUrl)
  const existingWindow = accountWindows.get(partition)

  if (existingWindow && !existingWindow.isDestroyed()) {
    if (existingWindow.webContents.getURL() !== targetUrl) {
      await existingWindow.loadURL(targetUrl)
    }

    existingWindow.show()
    existingWindow.focus()

    return {
      ok: true,
      partition,
      targetUrl,
    }
  }

  const authWindow = new BrowserWindow({
    width: 1320,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    autoHideMenuBar: true,
    backgroundColor: '#f4efe7',
    title: `${payload.label} · Session`,
    ...getBrowserWindowIconOptions(),
    webPreferences: {
      partition,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  accountWindows.set(partition, authWindow)

  authWindow.on('closed', () => {
    if (accountWindows.get(partition) === authWindow) {
      accountWindows.delete(partition)
    }
  })

  wireManagedWindow(authWindow, payload, 'Session')

  await authWindow.loadURL(targetUrl)

  return {
    ok: true,
    partition,
    targetUrl,
  }
}

async function openCodexWindowForAccount(payload: OpenAccountSessionPayload) {
  const partition = getAccountPartition(payload.accountId)
  const targetUrl = normalizeStartUrl(payload.startUrl)

  if (codexWindow && !codexWindow.isDestroyed() && codexPartition === partition) {
    if (codexWindow.webContents.getURL() !== targetUrl) {
      await codexWindow.loadURL(targetUrl)
    }

    codexWindow.show()
    codexWindow.focus()

    return {
      ok: true,
      partition,
      targetUrl,
    }
  }

  if (codexWindow && !codexWindow.isDestroyed()) {
    codexWindow.close()
  }

  const nextCodexWindow = new BrowserWindow({
    width: 1480,
    height: 980,
    minWidth: 1180,
    minHeight: 780,
    autoHideMenuBar: true,
    backgroundColor: '#f4efe7',
    title: `${payload.label} · Codex`,
    ...getBrowserWindowIconOptions(),
    webPreferences: {
      partition,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  codexWindow = nextCodexWindow
  codexPartition = partition

  nextCodexWindow.on('closed', () => {
    if (codexWindow === nextCodexWindow) {
      codexWindow = null
      codexPartition = ''
    }
  })

  wireManagedWindow(nextCodexWindow, payload, 'Codex')
  await nextCodexWindow.loadURL(targetUrl)

  return {
    ok: true,
    partition,
    targetUrl,
  }
}

async function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    await showMainWindow()
    return
  }

  const preloadPath = path.join(currentDirectory, 'preload.mjs')
  const indexHtmlPath = path.join(currentDirectory, '../dist/index.html')

  const window = new BrowserWindow({
    width: 1100,
    height: 740,
    minWidth: 780,
    minHeight: 520,
    backgroundColor: '#f8f9fa',
    title: APP_NAME,
    ...getBrowserWindowIconOptions(),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow = window
  ensureTray()

  window.on('close', (event) => {
    if (isQuitting) {
      return
    }

    event.preventDefault()
    hideMainWindow()
  })

  window.on('show', () => {
    rebuildTrayMenu()
  })

  window.on('hide', () => {
    rebuildTrayMenu()
  })

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null
    }

    rebuildTrayMenu()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    await window.loadFile(indexHtmlPath)
  }
}

ipcMain.handle('manager:get-state', async () => {
  const state = await readPersistedState()
  return {
    state,
    dataFilePath: getDataFilePath(),
  }
})

ipcMain.handle('manager:get-app-info', async () => {
  return {
    version: app.getVersion(),
    updateStatus,
  }
})

ipcMain.handle('manager:save-state', async (_event, rawState: AppState) => {
  const state = sanitizeState(rawState)
  await persistState(state)

  return {
    state,
    dataFilePath: getDataFilePath(),
  }
})

ipcMain.handle('manager:import-state', async () => {
  const selection = await dialog.showOpenDialog({
    title: `Import ${APP_NAME} JSON`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })

  if (selection.canceled || selection.filePaths.length === 0) {
    return { canceled: true }
  }

  const sourceFilePath = selection.filePaths[0]
  const raw = await readFile(sourceFilePath, 'utf8')
  const state = sanitizeState(JSON.parse(raw))
  await persistState(state)

  return {
    canceled: false,
    state,
    dataFilePath: getDataFilePath(),
    sourceFilePath,
  }
})

ipcMain.handle('manager:export-state', async (_event, rawState: AppState) => {
  const state = sanitizeState(rawState)
  const defaultPath = path.join(
    app.getPath('documents'),
    `codex-desk-export-${new Date().toISOString().slice(0, 10)}.json`,
  )

  const target = await dialog.showSaveDialog({
    title: `Export ${APP_NAME} JSON`,
    defaultPath,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })

  if (target.canceled || !target.filePath) {
    return { canceled: true }
  }

  await writeFile(target.filePath, JSON.stringify(state, null, 2), 'utf8')
  return {
    canceled: false,
    filePath: target.filePath,
  }
})

ipcMain.handle('manager:open-path', async (_event, targetPath: string) => {
  if (!targetPath || !targetPath.trim()) {
    return {
      ok: false,
      message: 'Duong dan dang rong.',
    }
  }

  const error = await shell.openPath(targetPath)

  if (error) {
    return {
      ok: false,
      message: error,
    }
  }

  return { ok: true }
})

ipcMain.handle('manager:open-data-directory', async () => {
  const dataFilePath = getDataFilePath()
  shell.showItemInFolder(dataFilePath)
  return { ok: true }
})

ipcMain.handle(
  'manager:open-account-session',
  async (_event, payload: OpenAccountSessionPayload) => {
    try {
      return await openAccountSessionWindow(payload)
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Khong mo duoc cua so session.',
      }
    }
  },
)

ipcMain.handle(
  'manager:open-codex-window',
  async (_event, payload: OpenAccountSessionPayload) => {
    try {
      return await openCodexWindowForAccount(payload)
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Khong mo duoc cua so Codex.',
      }
    }
  },
)

ipcMain.handle(
  'manager:capture-machine-codex-auth',
  async (_event, payload: SessionActionPayload) => {
    try {
      return await captureMachineCodexAuth(payload)
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Khong chup duoc auth Codex may.',
      }
    }
  },
)

ipcMain.handle(
  'manager:switch-machine-codex-auth',
  async (_event, payload: MachineCodexPayload) => {
    try {
      return await switchMachineCodexAuth(payload)
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Khong chuyen duoc Codex may.',
      }
    }
  },
)

ipcMain.handle(
  'manager:diagnose-codex-auth',
  async (_event, payload: DiagnoseCodexAuthPayload) => {
    try {
      return await diagnoseCodexAuth(payload)
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Khong chan doan duoc auth Codex may.',
      }
    }
  },
)

ipcMain.handle(
  'manager:read-machine-codex-usage',
  async (_event, payload: CodexUsageReadPayload) => {
    try {
      return await readMachineCodexUsage(payload)
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Khong doc duoc usage Codex.',
      }
    }
  },
)

ipcMain.handle(
  'manager:read-account-renewal-date',
  async (_event, payload: RenewalDateReadPayload) => {
    try {
      return await readAccountRenewalDate(payload)
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Khong doc duoc renewal date cua account.',
      }
    }
  },
)

ipcMain.handle(
  'manager:import-chat-backup',
  async (_event, payload: ChatBackupImportPayload) => {
    try {
      return await importChatBackup(payload)
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Khong import duoc backup ChatGPT.',
      }
    }
  },
)

ipcMain.handle(
  'manager:read-chat-backup',
  async (_event, payload: ChatBackupReadPayload) => {
    try {
      return await readChatBackup(payload)
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Khong doc duoc backup ChatGPT.',
      }
    }
  },
)

ipcMain.handle(
  'manager:reset-account-session',
  async (_event, payload: SessionActionPayload) => {
    const partition = getAccountPartition(payload.accountId)
    const existingWindow = accountWindows.get(partition)

    if (existingWindow && !existingWindow.isDestroyed()) {
      existingWindow.close()
      accountWindows.delete(partition)
    }

    if (codexWindow && !codexWindow.isDestroyed() && codexPartition === partition) {
      codexWindow.close()
      codexWindow = null
      codexPartition = ''
    }

    try {
      const accountSession = session.fromPartition(partition)
      await accountSession.clearStorageData()
      await accountSession.clearCache()

      return {
        ok: true,
        partition,
      }
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Khong reset duoc session.',
      }
    }
  },
)

ipcMain.handle(
  'manager:sync-account-session',
  async (_event, payload: SyncAccountSessionPayload) => {
    try {
      return await syncAccountSession(payload)
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Khong dong bo duoc session.',
      }
    }
  },
)

ipcMain.handle('manager:check-for-updates', async () => {
  return await checkForAppUpdates(true)
})

ipcMain.handle('manager:install-update', async () => {
  if (updateStatus.status !== 'downloaded') {
    return {
      ok: false,
      message: 'Ban cap nhat chua duoc tai xong.',
    }
  }

  setImmediate(() => {
    isQuitting = true
    autoUpdater.quitAndInstall()
  })

  return {
    ok: true,
  }
})

app.whenReady().then(async () => {
  app.setAppUserModelId(APP_ID)
  await mkdir(path.dirname(getDataFilePath()), { recursive: true })
  applyAppIcon()
  configureAutoUpdater()
  await createWindow()
  if (app.isPackaged) {
    setTimeout(() => {
      void checkForAppUpdates()
    }, 2500)
  }

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      void createWindow()
      return
    }

    void showMainWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
