export const planOptions = [
  'Plus',
  'Pro',
  'Business',
  'Enterprise',
  'Other',
] as const

export const statusOptions = [
  'Active',
  'Needs login',
  'Cooling down',
  'Archived',
] as const

export const priorityOptions = ['Primary', 'Burst', 'Backup'] as const

export const platformOptions = ['macOS', 'Windows', 'Shared'] as const

export const codexSurfaceOptions = ['CLI', 'App', 'Web', 'Mixed'] as const
export const appLanguages = ['vi', 'en', 'ja', 'zh-CN', 'hi', 'ko'] as const
export const themeModes = ['light', 'dark'] as const

export type Plan = (typeof planOptions)[number]
export type AccountStatus = (typeof statusOptions)[number]
export type AccountPriority = (typeof priorityOptions)[number]
export type AccountPlatform = (typeof platformOptions)[number]
export type CodexSurface = (typeof codexSurfaceOptions)[number]
export type AppLanguage = (typeof appLanguages)[number]
export type ThemeMode = (typeof themeModes)[number]

export interface AppPreferences {
  language: AppLanguage
  theme: ThemeMode
}

export type UpdateStatusKind =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateStatusSnapshot {
  status: UpdateStatusKind
  currentVersion: string
  nextVersion: string
  releaseName: string
  releaseNotes: string
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
  message: string
  checkedAt: string
}

export interface RepositoryRecord {
  id: string
  name: string
  path: string
  branch: string
  purpose: string
}

export interface ChatBackupRecord {
  id: string
  accountId: string
  sourceFileName: string
  sourceFilePath: string
  importedAt: string
  conversationCount: number
  messageCount: number
  firstConversationAt: string
  lastConversationAt: string
  titleSamples: string[]
}

export interface ChatBackupConversationMessage {
  id: string
  author: string
  createdAt: string
  text: string
}

export interface ChatBackupConversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
  participants: string[]
  preview: string
  messages: ChatBackupConversationMessage[]
}

export interface CodexUsageWindowSnapshot {
  usedPercent: number
  windowMinutes: number
  resetsAt: string
}

export interface CodexUsageSnapshot {
  lastSyncedAt: string
  recordedAt: string
  sourcePath: string
  planType: string
  limitReached: boolean
  primary: CodexUsageWindowSnapshot | null
  secondary: CodexUsageWindowSnapshot | null
  creditsSummary: string
}

export interface AccountRecord {
  id: string
  label: string
  email: string
  plan: Plan
  syncedName: string
  syncedEmail: string
  syncedImageUrl: string
  syncedPlan: string
  syncedWorkspaceName: string
  lastSyncedAt: string
  codexUsage: CodexUsageSnapshot | null
  isCodexActive: boolean
  machineCodexAuthCapturedAt: string
  machineCodexAuthAccountId: string
  machineCodexWorkspacePath: string
  status: AccountStatus
  priority: AccountPriority
  platform: AccountPlatform
  codexSurface: CodexSurface
  browserProfile: string
  profilePath: string
  launchCommand: string
  sessionStartUrl: string
  lastSessionOpenedAt: string
  renewalDate: string
  lastUsedAt: string
  monthlyBudget: string
  usagePattern: string
  tags: string[]
  notes: string
  repositories: RepositoryRecord[]
}

export interface AppState {
  version: 1
  updatedAt: string
  preferences: AppPreferences
  accounts: AccountRecord[]
  chatBackups: ChatBackupRecord[]
}

export interface StateResult {
  state: AppState
  dataFilePath: string
}

export interface AppInfoResult {
  version: string
  updateStatus: UpdateStatusSnapshot
}

export interface ImportStateResult extends Partial<StateResult> {
  canceled: boolean
  sourceFilePath?: string
}

export interface ExportStateResult {
  canceled: boolean
  filePath?: string
}

export interface OpenPathResult {
  ok: boolean
  message?: string
}

export interface OpenAccountSessionPayload {
  accountId: string
  label: string
  startUrl: string
}

export interface SessionActionPayload {
  accountId: string
}

export type DiagnoseCodexAuthPayload = SessionActionPayload

export type ChatBackupImportPayload = SessionActionPayload
export type CodexUsageReadPayload = SessionActionPayload
export interface RenewalDateReadPayload extends SessionActionPayload {
  startUrl?: string
}

export interface ChatBackupReadPayload {
  backupId: string
  accountId?: string
}

export interface SyncAccountSessionPayload extends SessionActionPayload {
  startUrl?: string
}

export interface MachineCodexPayload extends SessionActionPayload {
  label?: string
  email?: string
  workspacePath?: string
  relaunch?: boolean
}

export interface AccountSessionResult extends OpenPathResult {
  partition?: string
  targetUrl?: string
}

export interface SessionProfileSnapshot {
  authenticated: boolean
  name: string
  email: string
  imageUrl: string
  plan: string
  workspaceName: string
  targetUrl: string
  lastSyncedAt: string
}

export interface SyncAccountSessionResult extends OpenPathResult {
  partition?: string
  profile?: SessionProfileSnapshot
}

export interface MachineCodexResult extends OpenPathResult {
  authPath?: string
  snapshotPath?: string
  workspacePath?: string
  snapshotAccountId?: string
  profileExists?: boolean
  switched?: boolean
  loginInitiated?: boolean
}

export interface DiagnoseCodexAuthResult extends OpenPathResult {
  partition?: string
  slotAuthPath?: string
  slotAuthExists?: boolean
  slotAccountId?: string
  sessionPuid?: string
  sessionEmail?: string
}

export interface ChatBackupImportResult extends OpenPathResult {
  backup?: ChatBackupRecord
}

export interface ChatBackupReadResult extends OpenPathResult {
  backup?: ChatBackupRecord
  conversations?: ChatBackupConversation[]
}

export interface CodexUsageReadResult extends OpenPathResult {
  usage?: CodexUsageSnapshot
}

export interface RenewalDateReadResult extends OpenPathResult {
  partition?: string
  targetUrl?: string
  authenticated?: boolean
  renewalDate?: string
  source?: string
  matchedText?: string
}

export interface DesktopApi {
  getAppInfo: () => Promise<AppInfoResult>
  getState: () => Promise<StateResult>
  saveState: (state: AppState) => Promise<StateResult>
  importState: () => Promise<ImportStateResult>
  exportState: (state: AppState) => Promise<ExportStateResult>
  openPath: (targetPath: string) => Promise<OpenPathResult>
  openDataDirectory: () => Promise<OpenPathResult>
  openAccountSession: (
    payload: OpenAccountSessionPayload,
  ) => Promise<AccountSessionResult>
  openCodexWindow: (
    payload: OpenAccountSessionPayload,
  ) => Promise<AccountSessionResult>
  captureMachineCodexAuth: (
    payload: SessionActionPayload,
  ) => Promise<MachineCodexResult>
  switchMachineCodexAuth: (
    payload: MachineCodexPayload,
  ) => Promise<MachineCodexResult>
  diagnoseCodexAuth: (
    payload: DiagnoseCodexAuthPayload,
  ) => Promise<DiagnoseCodexAuthResult>
  readMachineCodexUsage: (
    payload: CodexUsageReadPayload,
  ) => Promise<CodexUsageReadResult>
  readAccountRenewalDate: (
    payload: RenewalDateReadPayload,
  ) => Promise<RenewalDateReadResult>
  importChatBackup: (
    payload: ChatBackupImportPayload,
  ) => Promise<ChatBackupImportResult>
  readChatBackup: (payload: ChatBackupReadPayload) => Promise<ChatBackupReadResult>
  resetAccountSession: (
    payload: SessionActionPayload,
  ) => Promise<AccountSessionResult>
  syncAccountSession: (
    payload: SyncAccountSessionPayload,
  ) => Promise<SyncAccountSessionResult>
  checkForUpdates: () => Promise<OpenPathResult & { updateStatus?: UpdateStatusSnapshot }>
  installUpdate: () => Promise<OpenPathResult>
  onUpdateStatus: (
    listener: (payload: UpdateStatusSnapshot) => void,
  ) => () => void
}

type UnknownRecord = Record<string, unknown>

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  )
}

function asEnum<T extends readonly string[]>(
  value: unknown,
  options: T,
  fallback: T[number],
): T[number] {
  if (typeof value === 'string' && options.includes(value as T[number])) {
    return value as T[number]
  }

  return fallback
}

export function createEmptyRepository(): RepositoryRecord {
  return {
    id: createId('repo'),
    name: '',
    path: '',
    branch: 'main',
    purpose: '',
  }
}

export function createEmptyAccount(): AccountRecord {
  return {
    id: createId('acct'),
    label: 'Tai khoan moi',
    email: '',
    plan: 'Plus',
    syncedName: '',
    syncedEmail: '',
    syncedImageUrl: '',
    syncedPlan: '',
    syncedWorkspaceName: '',
    lastSyncedAt: '',
    codexUsage: null,
    isCodexActive: false,
    machineCodexAuthCapturedAt: '',
    machineCodexAuthAccountId: '',
    machineCodexWorkspacePath: '',
    status: 'Active',
    priority: 'Primary',
    platform: 'Shared',
    codexSurface: 'Mixed',
    browserProfile: '',
    profilePath: '',
    launchCommand: '',
    sessionStartUrl: 'https://chatgpt.com/',
    lastSessionOpenedAt: '',
    renewalDate: '',
    lastUsedAt: '',
    monthlyBudget: '',
    usagePattern: '',
    tags: [],
    notes: '',
    repositories: [],
  }
}

export function createDefaultPreferences(): AppPreferences {
  return {
    language: 'vi',
    theme: 'light',
  }
}

export function createInitialState(): AppState {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    preferences: createDefaultPreferences(),
    accounts: [],
    chatBackups: [],
  }
}

export function getAccountPartition(accountId: string) {
  return `persist:codex-desk-account-${accountId}`
}

function sanitizeRepository(value: unknown): RepositoryRecord {
  const repository = isRecord(value) ? value : {}

  return {
    id: asString(repository.id, createId('repo')),
    name: asString(repository.name),
    path: asString(repository.path),
    branch: asString(repository.branch, 'main'),
    purpose: asString(repository.purpose),
  }
}

function sanitizeRepositories(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((repository) => sanitizeRepository(repository))
}

function sanitizeChatBackupRecord(value: unknown): ChatBackupRecord {
  const backup = isRecord(value) ? value : {}

  return {
    id: asString(backup.id, createId('backup')),
    accountId: asString(backup.accountId),
    sourceFileName: asString(backup.sourceFileName),
    sourceFilePath: asString(backup.sourceFilePath),
    importedAt: asString(backup.importedAt),
    conversationCount:
      typeof backup.conversationCount === 'number' && Number.isFinite(backup.conversationCount)
        ? backup.conversationCount
        : 0,
    messageCount:
      typeof backup.messageCount === 'number' && Number.isFinite(backup.messageCount)
        ? backup.messageCount
        : 0,
    firstConversationAt: asString(backup.firstConversationAt),
    lastConversationAt: asString(backup.lastConversationAt),
    titleSamples: asStringArray(backup.titleSamples),
  }
}

function sanitizeCodexUsageWindow(value: unknown): CodexUsageWindowSnapshot | null {
  if (!isRecord(value)) {
    return null
  }

  const usedPercent =
    typeof value.usedPercent === 'number' && Number.isFinite(value.usedPercent)
      ? value.usedPercent
      : NaN
  const windowMinutes =
    typeof value.windowMinutes === 'number' && Number.isFinite(value.windowMinutes)
      ? value.windowMinutes
      : NaN

  if (!Number.isFinite(usedPercent) || !Number.isFinite(windowMinutes)) {
    return null
  }

  return {
    usedPercent,
    windowMinutes,
    resetsAt: asString(value.resetsAt),
  }
}

function sanitizeCodexUsage(value: unknown): CodexUsageSnapshot | null {
  if (!isRecord(value)) {
    return null
  }

  return {
    lastSyncedAt: asString(value.lastSyncedAt),
    recordedAt: asString(value.recordedAt),
    sourcePath: asString(value.sourcePath),
    planType: asString(value.planType),
    limitReached: Boolean(value.limitReached),
    primary: sanitizeCodexUsageWindow(value.primary),
    secondary: sanitizeCodexUsageWindow(value.secondary),
    creditsSummary: asString(value.creditsSummary),
  }
}

function sanitizePreferences(value: unknown): AppPreferences {
  const preferences = isRecord(value) ? value : {}
  const empty = createDefaultPreferences()

  return {
    language: asEnum(preferences.language, appLanguages, empty.language),
    theme: asEnum(preferences.theme, themeModes, empty.theme),
  }
}

function sanitizeAccount(value: unknown): AccountRecord {
  const account = isRecord(value) ? value : {}
  const empty = createEmptyAccount()

  return {
    id: asString(account.id, createId('acct')),
    label: asString(account.label, empty.label),
    email: asString(account.email),
    plan: asEnum(account.plan, planOptions, empty.plan),
    syncedName: asString(account.syncedName),
    syncedEmail: asString(account.syncedEmail),
    syncedImageUrl: asString(account.syncedImageUrl),
    syncedPlan: asString(account.syncedPlan),
    syncedWorkspaceName: asString(account.syncedWorkspaceName),
    lastSyncedAt: asString(account.lastSyncedAt),
    codexUsage: sanitizeCodexUsage(account.codexUsage),
    isCodexActive: Boolean(account.isCodexActive),
    machineCodexAuthCapturedAt: asString(account.machineCodexAuthCapturedAt),
    machineCodexAuthAccountId: asString(account.machineCodexAuthAccountId),
    machineCodexWorkspacePath: asString(account.machineCodexWorkspacePath),
    status: asEnum(account.status, statusOptions, empty.status),
    priority: asEnum(account.priority, priorityOptions, empty.priority),
    platform: asEnum(account.platform, platformOptions, empty.platform),
    codexSurface: asEnum(
      account.codexSurface,
      codexSurfaceOptions,
      empty.codexSurface,
    ),
    browserProfile: asString(account.browserProfile),
    profilePath: asString(account.profilePath),
    launchCommand: asString(account.launchCommand),
    sessionStartUrl: asString(account.sessionStartUrl, empty.sessionStartUrl),
    lastSessionOpenedAt: asString(account.lastSessionOpenedAt),
    renewalDate: asString(account.renewalDate),
    lastUsedAt: asString(account.lastUsedAt),
    monthlyBudget: asString(account.monthlyBudget),
    usagePattern: asString(account.usagePattern),
    tags: asStringArray(account.tags),
    notes: asString(account.notes),
    repositories: sanitizeRepositories(account.repositories),
  }
}

export function sanitizeState(value: unknown): AppState {
  const state = isRecord(value) ? value : {}
  const preferences = sanitizePreferences(state.preferences)
  const accounts = Array.isArray(state.accounts)
    ? state.accounts.map((account) => sanitizeAccount(account))
    : []
  const chatBackups = Array.isArray(state.chatBackups)
    ? state.chatBackups.map((backup) => sanitizeChatBackupRecord(backup))
    : []
  const activeCodexAccountId =
    accounts.find((account) => account.isCodexActive)?.id ?? null
  const normalizedAccounts = accounts.map((account) => ({
    ...account,
    isCodexActive: activeCodexAccountId
      ? account.id === activeCodexAccountId
      : account.isCodexActive,
  }))

  return {
    version: 1,
    updatedAt: asString(state.updatedAt, new Date().toISOString()),
    preferences,
    accounts: normalizedAccounts,
    chatBackups,
  }
}

export function touchState(state: AppState): AppState {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
  }
}
