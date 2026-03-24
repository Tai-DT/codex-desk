import {
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Copy,
  CreditCard,
  Download,
  FileCode2,
  FolderKanban,
  FolderOpen,
  Grid2x2,
  HardDriveDownload,
  Import,
  LayoutDashboard,
  Languages,
  List,
  MonitorSmartphone,
  MoonStar,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  Sparkles,
  SunMedium,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react'
import './App.css'
import qrTimoImage from './assets/qr-timo.jpg'
import qrBinanceImage from './assets/qr-binance.png'
import appIconImage from './assets/app-icon.png'
import { desktopApi } from './desktop'
import {
  getIntlLocale,
  languageLabels,
  localizeDom,
  syncActiveLanguage,
  translateMessage,
} from './i18n'
import {
  appLanguages,
  codexSurfaceOptions,
  createEmptyAccount,
  createEmptyRepository,
  createInitialState,
  getAccountPartition,
  planOptions,
  platformOptions,
  priorityOptions,
  statusOptions,
  themeModes,
  touchState,
  type AccountRecord,
  type AppState,
  type ChatBackupConversation,
  type CodexUsageSnapshot,
  type UpdateStatusSnapshot,
} from './types'

type SaveStatus = 'loading' | 'idle' | 'saving' | 'saved' | 'error'
type BackupLoadStatus = 'idle' | 'loading' | 'error'
type AppView = 'dashboard' | 'accounts' | 'workspace' | 'backups' | 'settings'
type AccountsViewMode = 'grid' | 'list'

type NavItem = {
  id: AppView
  label: string
  caption: string
  icon: LucideIcon
}

const renewalWindowDays = 7
const dayInMs = 1000 * 60 * 60 * 24
const accountsViewStorageKey = 'codex-desk:accounts-view'
const initialUpdateStatus: UpdateStatusSnapshot = {
  status: 'idle',
  currentVersion: '',
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
const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    caption: 'Tong quan va de xuat',
    icon: LayoutDashboard,
  },
  {
    id: 'accounts',
    label: 'Accounts',
    caption: 'Grid/list va thao tac nhanh',
    icon: Users,
  },
  {
    id: 'workspace',
    label: 'Workspace',
    caption: 'Chinh sua profile dang focus',
    icon: FolderKanban,
  },
  {
    id: 'backups',
    label: 'Backups',
    caption: 'Luu kho chat export theo slot',
    icon: HardDriveDownload,
  },
  {
    id: 'settings',
    label: 'Settings',
    caption: 'Du lieu local va huong dan',
    icon: Settings2,
  },
]

function toDateInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function parseDateOnly(value: string) {
  if (!value) {
    return null
  }

  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function daysUntil(value: string) {
  const parsed = parseDateOnly(value)
  if (!parsed) {
    return null
  }

  const today = new Date()
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )
  return Math.ceil((parsed.getTime() - todayStart.getTime()) / dayInMs)
}

function formatDateLabel(value: string, fallback = 'Chua dat') {
  const parsed = parseDateOnly(value)
  if (!parsed) {
    return fallback
  }

  return new Intl.DateTimeFormat(getIntlLocale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}

function formatCompactDateTime(value: string, fallback = 'Chua co') {
  if (!value) {
    return fallback
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return fallback
  }

  return new Intl.DateTimeFormat(getIntlLocale(), {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

function formatPercent(value: number) {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`
}

function formatWindowMinutes(value: number) {
  if (value >= 1440 && value % 1440 === 0) {
    return `${value / 1440}d`
  }

  if (value >= 60 && value % 60 === 0) {
    return `${value / 60}h`
  }

  return `${value}m`
}

function remainingPercentFromUsage(usedPercent: number) {
  return Math.max(0, 100 - usedPercent)
}

function describeCodexUsageWindow(
  window: CodexUsageSnapshot['primary'] | undefined,
  fallback = 'Chua doc',
) {
  if (!window) {
    return fallback
  }

  return `Da dung ${formatPercent(window.usedPercent)}`
}

function summarizeCodexUsage(account: AccountRecord) {
  const usage = account.codexUsage
  if (!usage?.primary) {
    return ''
  }

  const parts = [
    `${formatWindowMinutes(usage.primary.windowMinutes)} con ~${formatPercent(
      remainingPercentFromUsage(usage.primary.usedPercent),
    )}`,
    usage.primary.resetsAt
      ? `reset ${formatCompactDateTime(usage.primary.resetsAt, '')}`
      : '',
    usage.secondary
      ? `${formatWindowMinutes(usage.secondary.windowMinutes)} da dung ${formatPercent(
          usage.secondary.usedPercent,
        )}`
      : '',
    usage.creditsSummary ? `credit ${usage.creditsSummary}` : '',
  ].filter(Boolean)

  return parts.join(' | ')
}

function toDateInputFromIso(value: string) {
  if (!value) {
    return ''
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return toDateInputValue(parsed)
}

function describeRenewal(value: string) {
  const diffDays = daysUntil(value)
  if (diffDays === null) {
    return 'Chua co lich gia han'
  }

  if (diffDays < 0) {
    return `Qua han ${Math.abs(diffDays)} ngay`
  }

  if (diffDays === 0) {
    return 'Gia han hom nay'
  }

  if (diffDays === 1) {
    return 'Gia han ngay mai'
  }

  return `${diffDays} ngay nua`
}

function isRenewalSoon(value: string) {
  const diffDays = daysUntil(value)
  return diffDays !== null && diffDays >= 0 && diffDays <= renewalWindowDays
}

function parseTags(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  )
}

function matchesAccount(
  account: AccountRecord,
  query: string,
  planFilter: string,
  statusFilter: string,
  platformFilter: string,
) {
  if (planFilter !== 'all' && account.plan !== planFilter) {
    return false
  }

  if (statusFilter !== 'all' && account.status !== statusFilter) {
    return false
  }

  if (platformFilter !== 'all' && account.platform !== platformFilter) {
    return false
  }

  if (!query) {
    return true
  }

  const searchBlob = [
    account.label,
    account.syncedName,
    account.email,
    account.syncedEmail,
    account.browserProfile,
    account.profilePath,
    account.launchCommand,
    account.usagePattern,
    account.notes,
    account.syncedPlan,
    account.syncedWorkspaceName,
    account.machineCodexAuthAccountId,
    account.machineCodexWorkspacePath,
    account.tags.join(' '),
    account.sessionStartUrl,
    account.repositories
      .map((repository) =>
        [
          repository.name,
          repository.path,
          repository.branch,
          repository.purpose,
        ].join(' '),
      )
      .join(' '),
  ]
    .join(' ')
    .toLowerCase()

  return searchBlob.includes(query)
}

function saveStatusLabel(status: SaveStatus) {
  switch (status) {
    case 'loading':
      return 'Dang nap du lieu'
    case 'saving':
      return 'Dang luu thay doi'
    case 'saved':
      return 'Da dong bo local'
    case 'error':
      return 'Gap loi khi luu'
    default:
      return 'San sang'
  }
}

function statusTone(status: AccountRecord['status']) {
  switch (status) {
    case 'Active':
      return 'success'
    case 'Needs login':
      return 'warning'
    case 'Cooling down':
      return 'accent'
    case 'Archived':
      return 'muted'
  }
}

function priorityTone(priority: AccountRecord['priority']) {
  switch (priority) {
    case 'Primary':
      return 'primary'
    case 'Burst':
      return 'burst'
    case 'Backup':
      return 'backup'
  }
}

function platformLabel(platform: AccountRecord['platform']) {
  switch (platform) {
    case 'macOS':
      return 'macOS'
    case 'Windows':
      return 'Windows'
    case 'Shared':
      return 'Shared'
  }
}

function accountScore(account: AccountRecord) {
  let score = 0

  if (account.status === 'Active') score += 45
  if (account.status === 'Cooling down') score += 15
  if (account.status === 'Needs login') score -= 10
  if (account.status === 'Archived') score -= 100

  if (account.priority === 'Primary') score += 24
  if (account.priority === 'Burst') score += 14
  if (account.priority === 'Backup') score += 7

  if (account.isCodexActive) score += 18
  if (account.lastSessionOpenedAt) score += 10
  if (account.lastSyncedAt) score += 8
  if (account.repositories.length > 0) score += Math.min(account.repositories.length * 4, 16)
  if (account.tags.length > 0) score += Math.min(account.tags.length * 2, 10)

  const renewalDays = daysUntil(account.renewalDate)
  if (renewalDays !== null) {
    if (renewalDays > 14) score += 14
    else if (renewalDays >= 7) score += 8
    else if (renewalDays >= 0) score += 3
    else score -= 14
  }

  return score
}

function statusHeadline(status: AccountRecord['status']) {
  if (status === 'Active') return 'Dang san sang'
  if (status === 'Needs login') return 'Can dang nhap lai'
  if (status === 'Cooling down') return 'Nen de nghi'
  return 'Da luu tru'
}

function accountSubtitle(account: AccountRecord) {
  if (account.lastSyncedAt) {
    return `Dong bo ${formatCompactDateTime(account.lastSyncedAt)}`
  }

  if (account.lastSessionOpenedAt) {
    return `Session gan nhat ${formatDateLabel(account.lastSessionOpenedAt)}`
  }

  if (account.browserProfile) {
    return `Profile ${account.browserProfile}`
  }

  return 'Chua co session da luu'
}

function hasMachineCodexSnapshot(account: AccountRecord) {
  return Boolean(account.machineCodexAuthCapturedAt)
}

function compactMachineCodexAccountId(value: string, fallback = 'Chua co') {
  const normalized = value.trim()
  if (!normalized) {
    return fallback
  }

  if (normalized.length <= 16) {
    return normalized
  }

  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`
}

function describeMachineCodexSnapshot(account: AccountRecord) {
  if (!hasMachineCodexSnapshot(account)) {
    return 'Chua co profile'
  }

  if (account.machineCodexAuthAccountId) {
    return compactMachineCodexAccountId(account.machineCodexAuthAccountId)
  }

  return 'Co profile, can xac nhan lai'
}

function normalizeDetectedPlan(rawPlan: string): AccountRecord['plan'] | null {
  const value = rawPlan.trim().toLowerCase()

  if (!value) {
    return null
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

  if (value.includes('plus') || value.includes('chatgptplus')) {
    return 'Plus'
  }

  return null
}

function displayAccountEmail(account: AccountRecord) {
  return account.syncedEmail || account.email || 'Chua co email'
}

function displayAccountPlan(account: AccountRecord) {
  return account.syncedPlan || account.plan
}

function isWorkspaceBilledPlan(account: AccountRecord) {
  const plan = displayAccountPlan(account).trim().toLowerCase()
  return plan.includes('business') || plan.includes('enterprise')
}

function displayAccountName(account: AccountRecord) {
  return account.label || account.syncedName || 'Tai khoan'
}

function resolveMachineCodexWorkspace(account: AccountRecord) {
  return (
    account.machineCodexWorkspacePath.trim() ||
    account.repositories.find((repository) => repository.path.trim())?.path.trim() ||
    ''
  )
}

function getDirectoryPath(filePath: string) {
  const normalized = filePath.trim()

  if (!normalized || normalized.startsWith('browser-storage://')) {
    return ''
  }

  const lastForwardSlash = normalized.lastIndexOf('/')
  const lastBackwardSlash = normalized.lastIndexOf('\\')
  const lastSeparatorIndex = Math.max(lastForwardSlash, lastBackwardSlash)

  return lastSeparatorIndex === -1 ? '' : normalized.slice(0, lastSeparatorIndex)
}

function joinPath(basePath: string, ...segments: string[]) {
  const normalizedBase = basePath.trim()
  if (!normalizedBase) {
    return ''
  }

  const separator = normalizedBase.includes('\\') ? '\\' : '/'
  const cleanedBase = normalizedBase.replace(/[\\/]+$/, '')
  const cleanedSegments = segments.map((segment) => segment.replace(/[\\/]+/g, ''))

  return [cleanedBase, ...cleanedSegments].join(separator)
}

function resolveMachineCodexProfilePath(
  account: AccountRecord,
  dataFilePath: string,
) {
  const dataDirectory = getDirectoryPath(dataFilePath)
  if (!dataDirectory) {
    return ''
  }

  return joinPath(dataDirectory, 'machine-codex', account.id)
}

function resolveChatBackupRootPath(dataFilePath: string) {
  const dataDirectory = getDirectoryPath(dataFilePath)
  if (!dataDirectory) {
    return ''
  }

  return joinPath(dataDirectory, 'chat-backups')
}

function resolveAccountChatBackupPath(account: AccountRecord, dataFilePath: string) {
  const rootPath = resolveChatBackupRootPath(dataFilePath)
  if (!rootPath) {
    return ''
  }

  return joinPath(rootPath, account.id)
}

function App() {
  const [appState, setAppState] = useState<AppState>(() => createInitialState())
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<AppView>('dashboard')
  const [accountsViewMode, setAccountsViewMode] = useState<AccountsViewMode>(() => {
    const stored = window.localStorage.getItem(accountsViewStorageKey)
    return stored === 'list' ? 'list' : 'grid'
  })
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('loading')
  const [dataFilePath, setDataFilePath] = useState('')
  const [appVersion, setAppVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusSnapshot>(initialUpdateStatus)
  const [notice, setNotice] = useState('')
  const [isHydrated, setIsHydrated] = useState(false)
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null)
  const [sessionActionAccountId, setSessionActionAccountId] = useState<string | null>(
    null,
  )
  const [renewalActionAccountId, setRenewalActionAccountId] = useState<
    string | null
  >(null)
  const [codexActionAccountId, setCodexActionAccountId] = useState<string | null>(null)
  const [codexUsageActionAccountId, setCodexUsageActionAccountId] = useState<
    string | null
  >(null)
  const [diagnoseAccountId, setDiagnoseAccountId] = useState<string | null>(null)
  const [backupActionAccountId, setBackupActionAccountId] = useState<string | null>(null)
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null)
  const [selectedBackupConversations, setSelectedBackupConversations] = useState<
    ChatBackupConversation[]
  >([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    null,
  )
  const [backupLoadStatus, setBackupLoadStatus] = useState<BackupLoadStatus>('idle')
  const [backupSearch, setBackupSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())
  const deferredBackupSearch = useDeferredValue(backupSearch.trim().toLowerCase())
  const currentLanguage = appState.preferences.language
  const currentTheme = appState.preferences.theme
  syncActiveLanguage(currentLanguage)
  const selectedAccount =
    appState.accounts.find((account) => account.id === selectedAccountId) ?? null
  const codexAccount =
    appState.accounts.find((account) => account.isCodexActive) ?? null
  const selectedAccountBackups = useMemo(
    () =>
      selectedAccount
        ? appState.chatBackups
            .filter((backup) => backup.accountId === selectedAccount.id)
            .sort((left, right) => right.importedAt.localeCompare(left.importedAt))
        : [],
    [appState.chatBackups, selectedAccount],
  )
  const selectedBackupRecord =
    selectedAccountBackups.find((backup) => backup.id === selectedBackupId) ?? null
  const filteredBackupConversations = useMemo(
    () =>
      selectedBackupConversations.filter((conversation) => {
        if (!deferredBackupSearch) {
          return true
        }

        const searchBlob = [
          conversation.title,
          conversation.preview,
          conversation.participants.join(' '),
          conversation.messages
            .map((message) => `${message.author} ${message.text}`)
            .join(' '),
        ]
          .join(' ')
          .toLowerCase()

        return searchBlob.includes(deferredBackupSearch)
      }),
    [deferredBackupSearch, selectedBackupConversations],
  )
  const selectedBackupConversation =
    filteredBackupConversations.find(
      (conversation) => conversation.id === selectedConversationId,
    ) ?? filteredBackupConversations[0] ?? null

  useEffect(() => {
    window.localStorage.setItem(accountsViewStorageKey, accountsViewMode)
  }, [accountsViewMode])

  useEffect(() => {
    document.documentElement.dataset.theme = currentTheme
    document.documentElement.lang = currentLanguage
    document.documentElement.style.colorScheme = currentTheme
  }, [currentLanguage, currentTheme])

  useEffect(() => {
    const root = document.getElementById('root')
    if (!(root instanceof HTMLElement)) {
      return
    }

    let frameId = 0
    const applyLocalization = () => {
      window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(() => {
        localizeDom(root, currentLanguage)
      })
    }

    applyLocalization()

    const observer = new MutationObserver(() => {
      applyLocalization()
    })

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label'],
    })

    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frameId)
    }
  }, [currentLanguage])

  useEffect(() => {
    return desktopApi.onUpdateStatus((payload) => {
      setUpdateStatus(payload)
      if (payload.currentVersion) {
        setAppVersion(payload.currentVersion)
      }
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      try {
        const [result, appInfo] = await Promise.all([
          desktopApi.getState(),
          desktopApi.getAppInfo(),
        ])

        if (cancelled) {
          return
        }

        setAppState(result.state)
        setSelectedAccountId(result.state.accounts[0]?.id ?? null)
        setDataFilePath(result.dataFilePath)
        setAppVersion(appInfo.version)
        setUpdateStatus(appInfo.updateStatus)
        setSaveStatus('idle')
      } catch (error) {
        console.error(error)
        if (!cancelled) {
          setNotice('Khong doc duoc file du lieu. App dang dung bo nho tam thoi.')
          setSaveStatus('error')
        }
      } finally {
        if (!cancelled) {
          setIsHydrated(true)
        }
      }
    }

    void hydrate()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (appState.accounts.length === 0) {
      if (selectedAccountId !== null) {
        setSelectedAccountId(null)
      }
      return
    }

    if (
      !selectedAccountId ||
      !appState.accounts.some((account) => account.id === selectedAccountId)
    ) {
      setSelectedAccountId(appState.accounts[0].id)
    }
  }, [appState.accounts, selectedAccountId])

  useEffect(() => {
    if (selectedAccountBackups.length === 0) {
      if (selectedBackupId !== null) {
        setSelectedBackupId(null)
      }
      return
    }

    if (
      !selectedBackupId ||
      !selectedAccountBackups.some((backup) => backup.id === selectedBackupId)
    ) {
      setSelectedBackupId(selectedAccountBackups[0].id)
    }
  }, [selectedAccountBackups, selectedBackupId])

  useEffect(() => {
    if (!selectedBackupRecord) {
      setSelectedBackupConversations([])
      setSelectedConversationId(null)
      setBackupLoadStatus('idle')
      return
    }

    const activeBackup = selectedBackupRecord
    let cancelled = false

    async function hydrateBackupDetail() {
      setBackupLoadStatus('loading')

      try {
        const result = await desktopApi.readChatBackup({
          backupId: activeBackup.id,
          accountId: activeBackup.accountId,
        })

        if (cancelled) {
          return
        }

        if (!result.ok || !result.conversations) {
          setSelectedBackupConversations([])
          setSelectedConversationId(null)
          setBackupLoadStatus('error')
          setNotice(result.message ?? 'Khong doc duoc noi dung backup da chon.')
          return
        }

        setSelectedBackupConversations(result.conversations)
        setSelectedConversationId(result.conversations[0]?.id ?? null)
        setBackupLoadStatus('idle')
      } catch (error) {
        console.error(error)

        if (!cancelled) {
          setSelectedBackupConversations([])
          setSelectedConversationId(null)
          setBackupLoadStatus('error')
          setNotice('Khong doc duoc noi dung backup da chon.')
        }
      }
    }

    void hydrateBackupDetail()

    return () => {
      cancelled = true
    }
  }, [selectedBackupRecord])

  useEffect(() => {
    if (filteredBackupConversations.length === 0) {
      if (selectedConversationId !== null) {
        setSelectedConversationId(null)
      }
      return
    }

    if (
      !selectedConversationId ||
      !filteredBackupConversations.some(
        (conversation) => conversation.id === selectedConversationId,
      )
    ) {
      setSelectedConversationId(filteredBackupConversations[0].id)
    }
  }, [filteredBackupConversations, selectedConversationId])

  const persistState = useEffectEvent(async (nextState: AppState) => {
    try {
      const result = await desktopApi.saveState(nextState)
      setDataFilePath(result.dataFilePath)
      setSaveStatus('saved')
    } catch (error) {
      console.error(error)
      setSaveStatus('error')
      setNotice('Khong the ghi thay doi xuong o dia.')
    }
  })

  useEffect(() => {
    if (!isHydrated) {
      return
    }

    setSaveStatus('saving')
    const timeoutId = window.setTimeout(() => {
      void persistState(appState)
    }, 250)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [appState, isHydrated])

  const filteredAccounts = useMemo(
    () =>
      appState.accounts.filter((account) =>
        matchesAccount(
          account,
          deferredSearch,
          planFilter,
          statusFilter,
          platformFilter,
        ),
      ),
    [appState.accounts, deferredSearch, planFilter, statusFilter, platformFilter],
  )

  const sortedRecommendations = useMemo(
    () =>
      [...appState.accounts]
        .sort((left, right) => accountScore(right) - accountScore(left))
        .slice(0, 4),
    [appState.accounts],
  )

  const totalRepos = appState.accounts.reduce(
    (sum, account) => sum + account.repositories.length,
    0,
  )
  const activeAccounts = appState.accounts.filter(
    (account) => account.status === 'Active',
  ).length
  const sessionReadyAccounts = appState.accounts.filter(
    (account) => account.lastSessionOpenedAt,
  ).length
  const soonRenewals = appState.accounts.filter((account) =>
    isRenewalSoon(account.renewalDate),
  ).length
  const totalPrimary = appState.accounts.filter(
    (account) => account.priority === 'Primary',
  ).length
  const statusBreakdown = {
    active: appState.accounts.filter((account) => account.status === 'Active').length,
    needsLogin: appState.accounts.filter((account) => account.status === 'Needs login')
      .length,
    cooling: appState.accounts.filter((account) => account.status === 'Cooling down')
      .length,
    archived: appState.accounts.filter((account) => account.status === 'Archived').length,
  }

  const pageMeta = {
    dashboard: { title: 'Control Center', description: '' },
    accounts: { title: 'Account Center', description: '' },
    workspace: { title: 'Workspace', description: '' },
    backups: { title: 'Backup Center', description: '' },
    settings: { title: 'Settings', description: '' },
  }[currentView]

  function updateState(mutator: (current: AppState) => AppState) {
    setAppState((current) => touchState(mutator(current)))
  }

  function updatePreferences(
    mutator: (current: AppState['preferences']) => AppState['preferences'],
  ) {
    updateState((current) => ({
      ...current,
      preferences: mutator(current.preferences),
    }))
  }

  function updateAccountById(
    accountId: string,
    mutator: (account: AccountRecord) => AccountRecord,
  ) {
    updateState((current) => ({
      ...current,
      accounts: current.accounts.map((account) =>
        account.id === accountId ? mutator(account) : account,
      ),
    }))
  }

  function updateSelectedAccount(
    mutator: (account: AccountRecord) => AccountRecord,
  ) {
    if (!selectedAccountId) {
      return
    }

    updateAccountById(selectedAccountId, mutator)
  }

  function focusAccount(accountId: string, nextView?: AppView) {
    setSelectedAccountId(accountId)
    if (nextView) {
      setCurrentView(nextView)
    }
  }

  async function handleSetCodexAccount(account = selectedAccount) {
    if (!account) {
      return
    }

    setCodexActionAccountId(account.id)
    setSelectedAccountId(account.id)

    try {
      const result = await desktopApi.switchMachineCodexAuth({
        accountId: account.id,
        label: displayAccountName(account),
        email: displayAccountEmail(account),
        workspacePath: resolveMachineCodexWorkspace(account),
        relaunch: true,
      })

      if (!result.ok) {
        setNotice(result.message ?? 'Khong mo duoc profile Codex cho slot nay.')
        return
      }

      const shouldMarkCodexActive = Boolean(result.switched)

      updateState((current) => ({
        ...current,
        accounts: current.accounts.map((entry) => ({
          ...entry,
          machineCodexAuthCapturedAt:
            entry.id === account.id
              ? result.profileExists
                ? entry.machineCodexAuthCapturedAt || new Date().toISOString()
                : ''
              : entry.machineCodexAuthCapturedAt,
          machineCodexAuthAccountId:
            entry.id === account.id
              ? result.snapshotAccountId || ''
              : entry.machineCodexAuthAccountId,
          isCodexActive: shouldMarkCodexActive
            ? entry.id === account.id
            : entry.isCodexActive,
          lastUsedAt:
            entry.id === account.id
              ? toDateInputValue()
              : entry.lastUsedAt,
        })),
      }))
      setNotice(
        result.message ??
          `Da mo profile Codex cua ${displayAccountName(account)}.`,
      )
    } finally {
      setCodexActionAccountId(null)
    }
  }

  async function handleCaptureMachineCodexAuth(account = selectedAccount) {
    if (!account) {
      return
    }

    setCodexActionAccountId(account.id)

    try {
      const result = await desktopApi.captureMachineCodexAuth({
        accountId: account.id,
      })

      if (!result.ok) {
        setNotice(result.message ?? 'Khong doc duoc profile Codex.')
        return
      }

      updateAccountById(account.id, (current) => ({
        ...current,
        machineCodexAuthCapturedAt: new Date().toISOString(),
        machineCodexAuthAccountId:
          result.snapshotAccountId || current.machineCodexAuthAccountId,
      }))
      const duplicateSlot =
        result.snapshotAccountId &&
        appState.accounts.find(
          (entry) =>
            entry.id !== account.id &&
            entry.machineCodexAuthAccountId === result.snapshotAccountId,
        )
      setNotice(
        duplicateSlot
          ? `Da cap nhat profile cho ${displayAccountName(account)}, nhung slot nay dang trung account voi ${displayAccountName(duplicateSlot)}.`
          : result.message ??
            `Da cap nhat profile Codex cho ${displayAccountName(account)}.`,
      )
    } finally {
      setCodexActionAccountId(null)
    }
  }

  async function handleDiagnoseCodexAuth(account = selectedAccount) {
    if (!account) {
      return
    }

    setDiagnoseAccountId(account.id)

    try {
      const result = await desktopApi.diagnoseCodexAuth({
        accountId: account.id,
      })

      if (!result.ok) {
        setNotice(result.message ?? 'Khong chan doan duoc profile Codex.')
        return
      }

      updateAccountById(account.id, (current) => ({
        ...current,
        machineCodexAuthCapturedAt:
          result.slotAuthExists
            ? current.machineCodexAuthCapturedAt || new Date().toISOString()
            : '',
        machineCodexAuthAccountId: result.slotAccountId || '',
      }))

      const puidLabel = result.sessionPuid
        ? result.sessionPuid.split(':')[0]
        : 'khong co'
      const summary = [
        `slot=${result.slotAuthExists ? 'co' : 'chua co'}`,
        `slot_id=${result.slotAccountId || 'none'}`,
        `session=${puidLabel}`,
        result.sessionEmail ? `email=${result.sessionEmail}` : '',
      ]
        .filter(Boolean)
        .join(' | ')

      setNotice(`Chan doan ${displayAccountName(account)}: ${summary}`)
    } finally {
      setDiagnoseAccountId(null)
    }
  }

  function addAccount() {
    const account = createEmptyAccount()
    const shouldActivateCodex = appState.accounts.every(
      (entry) => !entry.isCodexActive,
    )

    startTransition(() => {
      updateState((current) => ({
        ...current,
        accounts: [
          {
            ...account,
            isCodexActive: shouldActivateCodex,
          },
          ...current.accounts,
        ],
      }))
      setSelectedAccountId(account.id)
      setCurrentView('workspace')
      setNotice('Da tao mot ho so tai khoan moi.')
    })
  }

  function duplicateSelectedAccount() {
    if (!selectedAccount) {
      return
    }

    const duplicate: AccountRecord = {
      ...selectedAccount,
      id: createEmptyAccount().id,
      label: `${selectedAccount.label} Copy`,
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
      machineCodexWorkspacePath: selectedAccount.machineCodexWorkspacePath,
      lastSessionOpenedAt: '',
      status: selectedAccount.status === 'Archived' ? 'Archived' : 'Needs login',
      repositories: selectedAccount.repositories.map((repository) => ({
        ...repository,
        id: createEmptyRepository().id,
      })),
    }

    startTransition(() => {
      updateState((current) => ({
        ...current,
        accounts: [duplicate, ...current.accounts],
      }))
      setSelectedAccountId(duplicate.id)
      setCurrentView('workspace')
      setNotice('Da nhan ban account dang focus.')
    })
  }

  function deleteSelectedAccount() {
    if (!selectedAccount) {
      return
    }

    const confirmed = window.confirm(
      translateMessage(`Xoa "${selectedAccount.label}" khoi dashboard nay?`, currentLanguage),
    )

    if (!confirmed) {
      return
    }

    updateState((current) => ({
      ...current,
      accounts: current.accounts.filter(
        (account) => account.id !== selectedAccount.id,
      ),
    }))
    setNotice(`Da xoa ${selectedAccount.label}.`)
  }

  function addRepository() {
    updateSelectedAccount((account) => ({
      ...account,
      repositories: [...account.repositories, createEmptyRepository()],
    }))
  }

  function updateRepository(
    repositoryId: string,
    field: 'name' | 'path' | 'branch' | 'purpose',
    value: string,
  ) {
    updateSelectedAccount((account) => ({
      ...account,
      repositories: account.repositories.map((repository) =>
        repository.id === repositoryId
          ? { ...repository, [field]: value }
          : repository,
      ),
    }))
  }

  function removeRepository(repositoryId: string) {
    updateSelectedAccount((account) => ({
      ...account,
      repositories: account.repositories.filter(
        (repository) => repository.id !== repositoryId,
      ),
    }))
  }

  async function handleExport() {
    const result = await desktopApi.exportState(appState)
    if (!result.canceled) {
      setNotice(
        result.filePath
          ? `Da xuat JSON ra ${result.filePath}.`
          : 'Da xuat du lieu.',
      )
    }
  }

  async function handleImport() {
    const result = await desktopApi.importState()
    if (result.canceled || !result.state) {
      return
    }

    setAppState(result.state)
    setSelectedAccountId(result.state.accounts[0]?.id ?? null)
    if (result.dataFilePath) {
      setDataFilePath(result.dataFilePath)
    }
    setNotice(
      result.sourceFilePath
        ? `Da nap du lieu tu ${result.sourceFilePath}.`
        : 'Da nap du lieu JSON.',
    )
  }

  async function handleOpenPath(targetPath: string, label: string) {
    const result = await desktopApi.openPath(targetPath)
    if (!result.ok) {
      setNotice(result.message ?? `Khong mo duoc ${label}.`)
      return
    }

    setNotice(`Da yeu cau he dieu hanh mo ${label}.`)
  }

  async function handleOpenDataDirectory() {
    const result = await desktopApi.openDataDirectory()
    if (!result.ok) {
      setNotice(result.message ?? 'Khong mo duoc thu muc du lieu.')
      return
    }

    setNotice('Da mo vi tri luu du lieu local.')
  }

  async function handleImportChatBackup(account = selectedAccount) {
    if (!account) {
      return
    }

    setBackupActionAccountId(account.id)

    try {
      const result = await desktopApi.importChatBackup({
        accountId: account.id,
      })

      if (!result.ok || !result.backup) {
        if (result.message) {
          setNotice(result.message)
        }
        return
      }

      updateState((current) => ({
        ...current,
        chatBackups: [result.backup!, ...current.chatBackups],
      }))
      setSelectedAccountId(account.id)
      setCurrentView('backups')
      setSelectedBackupId(result.backup.id)
      setSelectedConversationId(null)
      setNotice(
        result.message ?? `Da import backup chat cho ${displayAccountName(account)}.`,
      )
    } finally {
      setBackupActionAccountId(null)
    }
  }

  async function handleOpenChatBackupFolder(account = selectedAccount) {
    if (!account) {
      return
    }

    const backupPath = resolveAccountChatBackupPath(account, dataFilePath)

    if (!backupPath) {
      setNotice('Chua xac dinh duoc thu muc backup chat trong build hien tai.')
      return
    }

    await handleOpenPath(
      backupPath,
      `backup chat cua ${displayAccountName(account)}`,
    )
  }

  async function handleOpenMachineCodexProfileFolder(account = selectedAccount) {
    if (!account) {
      return
    }

    const profilePath = resolveMachineCodexProfilePath(account, dataFilePath)

    if (!profilePath) {
      setNotice('Chua xac dinh duoc thu muc profile Codex trong build hien tai.')
      return
    }

    await handleOpenPath(
      profilePath,
      `profile Codex cua ${displayAccountName(account)}`,
    )
  }

  async function copyText(value: string, label: string) {
    if (!value.trim()) {
      setNotice(`Chua co ${label} de copy.`)
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      setNotice(`Da copy ${label}.`)
    } catch (error) {
      console.error(error)
      setNotice(`Khong copy duoc ${label}.`)
    }
  }

  async function handleOpenAccountSession(
    account = selectedAccount,
    overrideUrl?: string,
    successMessage?: string,
  ) {
    if (!account) {
      return
    }

    setSessionActionAccountId(account.id)

    try {
      const result = await desktopApi.openAccountSession({
        accountId: account.id,
        label: displayAccountName(account),
        startUrl: overrideUrl || account.sessionStartUrl,
      })

      if (!result.ok) {
        setNotice(result.message ?? 'Khong mo duoc cua so session rieng.')
        return
      }

      updateAccountById(account.id, (current) => ({
        ...current,
        lastSessionOpenedAt: new Date().toISOString(),
        lastUsedAt: current.lastUsedAt || toDateInputValue(),
      }))
      setSelectedAccountId(account.id)
      setNotice(
        successMessage ||
          `Da mo session rieng cho ${displayAccountName(account)}. Dang nhap trong cua so do, cookies se duoc giu theo partition rieng.`,
      )
    } finally {
      setSessionActionAccountId(null)
    }
  }

  async function handleOpenBillingCenter(account = selectedAccount) {
    if (!account) {
      return
    }

    if (isWorkspaceBilledPlan(account)) {
      await handleOpenAccountSession(
        account,
        'https://chatgpt.com/admin/billing',
        `Da mo trang Billing cho ${displayAccountName(account)}. Neu ban la owner/admin cua workspace, ban co the xem invoice va chu ky billing ngay trong cua so nay.`,
      )
      return
    }

    await handleOpenAccountSession(
      account,
      'https://chatgpt.com/#settings/Account',
      `Da mo trang Account cho ${displayAccountName(account)}. Renewal date cua goi ca nhan thuong nam ngay trong modal nay; neu can thao tac billing them thi bam Manage.`,
    )
  }

  async function handleSyncRenewalDate(account = selectedAccount) {
    if (!account) {
      return
    }

    setRenewalActionAccountId(account.id)

    try {
      const result = await desktopApi.readAccountRenewalDate({
        accountId: account.id,
        startUrl: isWorkspaceBilledPlan(account)
          ? 'https://chatgpt.com/admin/billing'
          : 'https://chatgpt.com/#settings/Account',
      })

      if (!result.ok || !result.renewalDate) {
        setNotice(
          result.message ??
            `Khong doc duoc renewal date cho ${displayAccountName(account)}.`,
        )
        return
      }

      updateAccountById(account.id, (current) => ({
        ...current,
        renewalDate: result.renewalDate ?? current.renewalDate,
      }))
      setSelectedAccountId(account.id)

      const sourceSuffix = result.source ? ` (${result.source})` : ''
      setNotice(
        `Da dien Gia han ${formatDateLabel(result.renewalDate, result.renewalDate)} cho ${displayAccountName(account)}${sourceSuffix}.`,
      )
    } catch (error) {
      console.error(error)
      setNotice(`Khong doc duoc renewal date cho ${displayAccountName(account)}.`)
    } finally {
      setRenewalActionAccountId(null)
    }
  }

  async function handleOpenCodex(account = codexAccount) {
    if (!account) {
      setNotice(
        'Chua chon account nao cho Codex. Vao Workspace va bam "Mo profile Codex".',
      )
      return
    }

    await handleSetCodexAccount(account)
  }

  async function handleResetAccountSession(account = selectedAccount) {
    if (!account) {
      return
    }

    const confirmed = window.confirm(
      translateMessage(
        `Reset session rieng cua "${displayAccountName(account)}"? Thao tac nay se xoa cookies va buoc dang nhap lai.`,
        currentLanguage,
      ),
    )

    if (!confirmed) {
      return
    }

    setSessionActionAccountId(account.id)

    try {
      const result = await desktopApi.resetAccountSession({
        accountId: account.id,
      })

      if (!result.ok) {
        setNotice(result.message ?? 'Khong reset duoc session rieng.')
        return
      }

      updateAccountById(account.id, (current) => ({
        ...current,
        syncedName: '',
        syncedEmail: '',
        syncedImageUrl: '',
        syncedPlan: '',
        syncedWorkspaceName: '',
        lastSyncedAt: '',
        lastSessionOpenedAt: '',
        status: current.status === 'Archived' ? current.status : 'Needs login',
      }))
      setNotice(
        `Da xoa session rieng cua ${displayAccountName(account)}. Mo lai cua so session de dang nhap tai khoan nay.`,
      )
    } finally {
      setSessionActionAccountId(null)
    }
  }

  async function handleSyncAccountSession(account = selectedAccount) {
    if (!account) {
      return
    }

    setSyncingAccountId(account.id)

    try {
      const result = await desktopApi.syncAccountSession({
        accountId: account.id,
        startUrl: account.sessionStartUrl,
      })

      if (!result.ok || !result.profile) {
        setNotice(result.message ?? 'Khong dong bo duoc session hien tai.')
        return
      }

      const profile = result.profile
      const normalizedPlan = normalizeDetectedPlan(profile.plan)
      const shouldAutoLabel =
        !account.label.trim() ||
        account.label === 'Tai khoan moi' ||
        account.label === account.syncedName
      const shouldAutoEmail = !account.email.trim() || account.email === account.syncedEmail
      const shouldAutoPlan =
        account.plan === 'Other' ||
        !account.syncedPlan ||
        account.plan === normalizeDetectedPlan(account.syncedPlan)

      updateAccountById(account.id, (current) => ({
        ...current,
        label:
          shouldAutoLabel && profile.name
            ? profile.name
            : current.label,
        email:
          shouldAutoEmail && profile.email
            ? profile.email
            : current.email,
        plan:
          normalizedPlan && shouldAutoPlan ? normalizedPlan : current.plan,
        syncedName: profile.name || current.syncedName,
        syncedEmail: profile.email || current.syncedEmail,
        syncedImageUrl: profile.imageUrl || current.syncedImageUrl,
        syncedPlan: profile.plan || current.syncedPlan,
        syncedWorkspaceName:
          profile.workspaceName || current.syncedWorkspaceName,
        lastSyncedAt: profile.lastSyncedAt,
        status:
          current.status === 'Archived'
            ? current.status
            : profile.authenticated
              ? 'Active'
              : 'Needs login',
        isCodexActive:
          current.isCodexActive ||
          (profile.authenticated &&
            appState.accounts.every((entry) => !entry.isCodexActive)),
      }))
      setSelectedAccountId(account.id)
      setNotice(
        result.message ??
          `Da dong bo thong tin session cho ${displayAccountName(account)}.`,
      )
    } finally {
      setSyncingAccountId(null)
    }
  }

  async function handleReadMachineCodexUsage(account = selectedAccount) {
    if (!account) {
      return
    }

    setCodexUsageActionAccountId(account.id)

    try {
      const result = await desktopApi.readMachineCodexUsage({
        accountId: account.id,
      })

      if (!result.ok || !result.usage) {
        setNotice(result.message ?? 'Khong doc duoc usage Codex tu profile nay.')
        return
      }

      const usageDate = toDateInputFromIso(result.usage.recordedAt)

      updateAccountById(account.id, (current) => ({
        ...current,
        codexUsage: result.usage ?? current.codexUsage,
        lastUsedAt:
          usageDate && (!current.lastUsedAt || usageDate > current.lastUsedAt)
            ? usageDate
            : current.lastUsedAt,
      }))
      setNotice(result.message ?? 'Da cap nhat usage Codex tu log local.')
    } finally {
      setCodexUsageActionAccountId(null)
    }
  }

  async function handleCheckForUpdates() {
    const result = await desktopApi.checkForUpdates()
    if (!result.ok && result.message) {
      setNotice(result.message)
    }
  }

  async function handleInstallUpdate() {
    const result = await desktopApi.installUpdate()
    if (!result.ok && result.message) {
      setNotice(result.message)
    }
  }

  function formatUpdateStatusLabel(snapshot: UpdateStatusSnapshot) {
    switch (snapshot.status) {
      case 'checking':
        return 'Dang kiem tra update'
      case 'available':
        return snapshot.nextVersion
          ? `Tim thay ${snapshot.nextVersion}`
          : 'Da tim thay ban moi'
      case 'not-available':
        return 'Da moi nhat'
      case 'downloading':
        return snapshot.percent > 0
          ? `Dang tai ${snapshot.percent.toFixed(0)}%`
          : 'Dang tai ban moi'
      case 'downloaded':
        return snapshot.nextVersion
          ? `San sang cai ${snapshot.nextVersion}`
          : 'San sang cai dat'
      case 'error':
        return 'Loi update'
      default:
        return 'Kiem tra update'
    }
  }

  function renderTopbarActions() {
    return (
      <div className="topbar-actions">
        {codexAccount ? (
          <button
            className="button secondary"
            type="button"
            disabled={codexActionAccountId === codexAccount.id}
            onClick={() => void handleOpenCodex()}
          >
            <Play className="icon-sm" />
            {codexActionAccountId === codexAccount.id
              ? `Dang mo profile Codex...`
              : `Mo Codex: ${displayAccountName(codexAccount)}`}
          </button>
        ) : null}
        <button className="button ghost" type="button" onClick={handleImport}>
          <Import className="icon-sm" />
          Import
        </button>
        <button className="button ghost" type="button" onClick={handleExport}>
          <Download className="icon-sm" />
          Export
        </button>
        <button className="button ghost" type="button" onClick={() => void handleCheckForUpdates()}>
          <RefreshCcw className="icon-sm" />
          {formatUpdateStatusLabel(updateStatus)}
        </button>
        <button className="button primary" type="button" onClick={addAccount}>
          <Plus className="icon-sm" />
          Add Account
        </button>
      </div>
    )
  }

  function renderStatCard(
    icon: LucideIcon,
    label: string,
    value: string | number,
    hint: string,
    tone: 'blue' | 'green' | 'amber' | 'violet' | 'cyan',
  ) {
    const Icon = icon

    return (
      <article className={`stat-card tone-${tone}`}>
        <div className="stat-icon">
          <Icon className="icon-md" />
        </div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        <p className="stat-hint">{hint}</p>
      </article>
    )
  }

  function renderAccountMiniCard(
    account: AccountRecord,
    options?: {
      compact?: boolean
      showActions?: boolean
    },
  ) {
    const compact = options?.compact ?? false
    const showActions = options?.showActions ?? true
    const renewalDays = daysUntil(account.renewalDate)
    const isSyncBusy = syncingAccountId === account.id
    const isSessionBusy = sessionActionAccountId === account.id
    const isCodexBusy = codexActionAccountId === account.id
    const isUsageBusy = codexUsageActionAccountId === account.id
    const codexUsageSummary = summarizeCodexUsage(account)

    return (
      <article
        key={account.id}
        className={`account-tile ${compact ? 'compact' : ''} ${
          selectedAccountId === account.id ? 'is-selected' : ''
        }`}
      >
        <div className="account-tile-head">
          <div>
            <div className="account-title-row">
              <strong>{displayAccountName(account)}</strong>
              {account.isCodexActive ? (
                <span className="badge tone-primary">Codex may</span>
              ) : null}
              <span className={`badge tone-${statusTone(account.status)}`}>
                {account.status}
              </span>
            </div>
            <p>{displayAccountEmail(account)}</p>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={() => focusAccount(account.id, 'workspace')}
            aria-label={`Mo workspace cho ${account.label}`}
          >
            <ChevronRight className="icon-sm" />
          </button>
        </div>

        <div className="tile-meta-row">
          <span className={`badge soft tone-${priorityTone(account.priority)}`}>
            {account.priority}
          </span>
          <span className="badge soft">{displayAccountPlan(account)}</span>
          <span className="badge soft">{platformLabel(account.platform)}</span>
          {account.lastSyncedAt ? <span className="badge soft">Synced</span> : null}
          {hasMachineCodexSnapshot(account) ? (
            <span className="badge soft">
              Codex profile{' '}
              {compactMachineCodexAccountId(account.machineCodexAuthAccountId, '')}
            </span>
          ) : (
            <span className="badge tone-warning">Chua co profile Codex</span>
          )}
        </div>

        <div className="tile-grid">
          <div>
            <span>Session</span>
            <strong>{account.lastSessionOpenedAt ? 'Ready' : 'Chua login'}</strong>
          </div>
          <div>
            <span>Repos</span>
            <strong>{account.repositories.length}</strong>
          </div>
          <div>
            <span>Gia han</span>
            <strong>
              {renewalDays === null
                ? 'Chua dat'
                : renewalDays < 0
                  ? `Qua ${Math.abs(renewalDays)}d`
                  : `${renewalDays}d`}
            </strong>
          </div>
          <div>
            <span>Surface</span>
            <strong>{account.codexSurface}</strong>
          </div>
        </div>

        <p className="tile-footnote">{accountSubtitle(account)}</p>
        {codexUsageSummary ? <p className="tile-footnote">{codexUsageSummary}</p> : null}

        {account.tags.length > 0 ? (
          <div className="tag-line">
            {account.tags.slice(0, compact ? 2 : 3).map((tag) => (
              <span className="tag-chip" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {showActions ? (
          <div className="tile-actions">
            <button
              className="button ghost small"
              type="button"
              onClick={() => focusAccount(account.id, 'workspace')}
            >
              Edit
            </button>
            <button
              className="button ghost small"
              type="button"
              disabled={isSyncBusy}
              onClick={() => void handleSyncAccountSession(account)}
            >
              {isSyncBusy ? 'Dang sync...' : 'Sync'}
            </button>
            <button
              className="button ghost small"
              type="button"
              disabled={isUsageBusy}
              onClick={() => void handleReadMachineCodexUsage(account)}
            >
              {isUsageBusy ? 'Dang doc usage...' : 'Usage'}
            </button>
            <button
              className="button secondary small"
              type="button"
              disabled={isSessionBusy}
              onClick={() => void handleOpenAccountSession(account)}
            >
              <Play className="icon-sm" />
              {isSessionBusy ? 'Dang mo...' : 'Open Session'}
            </button>
            <button
              className="button secondary small"
              type="button"
              disabled={isCodexBusy}
              onClick={() => void handleCaptureMachineCodexAuth(account)}
            >
              {isCodexBusy && !account.isCodexActive
                ? 'Dang xu ly...'
                : 'Kiem tra profile'}
            </button>
            <button
              className="button secondary small"
              type="button"
              disabled={isCodexBusy}
              onClick={() => void handleSetCodexAccount(account)}
            >
              {isCodexBusy
                ? 'Dang chuyen...'
                : account.isCodexActive
                  ? 'Profile dang mo'
                  : 'Mo profile Codex'}
            </button>
          </div>
        ) : null}
      </article>
    )
  }

  function renderDashboard() {
    const spotlight = selectedAccount ?? sortedRecommendations[0] ?? null

    return (
      <div className="view-stack">
        <section className="hero-board">
          <div className="hero-copy">
            <h1 style={{ fontSize: '0.92rem' }}>{`${appState.accounts.length} accounts · ${sessionReadyAccounts} ready · ${soonRenewals} renewals`}</h1>
          </div>

          <div className="hero-inline-actions">
            <button className="button primary" type="button" onClick={addAccount}>
              <Plus className="icon-sm" />
              Tao slot moi
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => setCurrentView('accounts')}
            >
              <Users className="icon-sm" />
              Mo Account Center
            </button>
          </div>
        </section>

        <section className="stats-grid">
          {renderStatCard(
            Users,
            'Tong accounts',
            appState.accounts.length,
            `${activeAccounts} slot dang Active`,
            'blue',
          )}
          {renderStatCard(
            Sparkles,
            'Session ready',
            sessionReadyAccounts,
            'Da co session luu local',
            'green',
          )}
          {renderStatCard(
            FileCode2,
            'Repo gan kem',
            totalRepos,
            `${totalPrimary} slot o vai tro Primary`,
            'violet',
          )}
          {renderStatCard(
            Clock3,
            'Gia han sap toi',
            soonRenewals,
            `Trong ${renewalWindowDays} ngay toi`,
            'amber',
          )}
        </section>

        <section className="dashboard-grid">
          <div className="panel spotlight-panel">
            <div className="panel-head">
              <h2>Spotlight</h2>
              {spotlight ? (
                <button
                  className="button ghost small"
                  type="button"
                  onClick={() => focusAccount(spotlight.id, 'workspace')}
                >
                  Mo workspace
                </button>
              ) : null}
            </div>

            {spotlight ? (
              <>
                <div className="spotlight-card">
                  <div className="spotlight-head">
                    <div>
                      <div className="spotlight-title">
                        <h3>{displayAccountName(spotlight)}</h3>
                        {spotlight.isCodexActive ? (
                          <span className="badge tone-primary">Profile Codex dang mo</span>
                        ) : null}
                        <span className={`badge tone-${statusTone(spotlight.status)}`}>
                          {statusHeadline(spotlight.status)}
                        </span>
                      </div>
                      <p>{displayAccountEmail(spotlight)}</p>
                    </div>
                    <div className="score-badge">
                      <Sparkles className="icon-sm" />
                      Score {accountScore(spotlight)}
                    </div>
                  </div>

                  <div className="spotlight-metrics">
                    <div className="mini-stat">
                      <span>Session</span>
                      <strong>
                        {spotlight.lastSessionOpenedAt
                          ? formatCompactDateTime(spotlight.lastSessionOpenedAt)
                          : 'Chua login'}
                      </strong>
                    </div>
                    <div className="mini-stat">
                      <span>Gia han</span>
                      <strong>{describeRenewal(spotlight.renewalDate)}</strong>
                    </div>
                    <div className="mini-stat">
                      <span>Plan</span>
                      <strong>{displayAccountPlan(spotlight)}</strong>
                    </div>
                  </div>

                  <div className="spotlight-actions">
                    <button
                      className="button primary"
                      type="button"
                      onClick={() => void handleOpenAccountSession(spotlight)}
                    >
                      <Play className="icon-sm" />
                      Dang nhap / Mo session
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => void handleSyncAccountSession(spotlight)}
                    >
                      <RefreshCcw className="icon-sm" />
                      Sync tai khoan
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      disabled={codexActionAccountId === spotlight.id}
                      onClick={() => void handleCaptureMachineCodexAuth(spotlight)}
                    >
                      <Copy className="icon-sm" />
                      {codexActionAccountId === spotlight.id
                        ? 'Dang xu ly...'
                        : 'Kiem tra profile'}
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      disabled={codexActionAccountId === spotlight.id}
                      onClick={() => void handleSetCodexAccount(spotlight)}
                    >
                      <Sparkles className="icon-sm" />
                      {codexActionAccountId === spotlight.id
                        ? 'Dang chuyen...'
                        : 'Mo profile Codex'}
                    </button>
                    <button
                      className="button ghost"
                      type="button"
                      onClick={() => focusAccount(spotlight.id, 'workspace')}
                    >
                      <FolderKanban className="icon-sm" />
                      Edit profile
                    </button>
                  </div>
                </div>

                  <div className="spotlight-note">
                    <div className="info-chip">
                      <MonitorSmartphone className="icon-sm" />
                      <span>{platformLabel(spotlight.platform)}</span>
                    </div>
                  <div className="info-chip">
                    <Boxes className="icon-sm" />
                    <span>{spotlight.codexSurface}</span>
                  </div>
                    <div className="info-chip">
                      <Clock3 className="icon-sm" />
                      <span>{spotlight.lastUsedAt ? formatDateLabel(spotlight.lastUsedAt) : 'Chua co lich su'}</span>
                    </div>
                    {spotlight.lastSyncedAt ? (
                      <div className="info-chip">
                        <CheckCircle2 className="icon-sm" />
                        <span>{formatCompactDateTime(spotlight.lastSyncedAt)}</span>
                      </div>
                    ) : null}
                  </div>
              </>
            ) : (
              <div className="empty-panel">
                <h3>Chua co account nao</h3>
                <p>Tao account dau tien de bat dau luu session va repo.</p>
              </div>
            )}
          </div>

          <div className="panel quick-panel">
            <div className="panel-head">
              <h2>Quick Actions</h2>
            </div>

            <div className="quick-stack">
              <button className="quick-action" type="button" onClick={handleImport}>
                <Import className="icon-sm" />
                <div>
                  <strong>Import JSON</strong>
                </div>
              </button>
              <button className="quick-action" type="button" onClick={handleExport}>
                <Download className="icon-sm" />
                <div>
                  <strong>Export JSON</strong>
                </div>
              </button>
              <button
                className="quick-action"
                type="button"
                onClick={handleOpenDataDirectory}
              >
                <HardDriveDownload className="icon-sm" />
                <div>
                  <strong>Mo thu muc</strong>
                </div>
              </button>
              <button
                className="quick-action"
                type="button"
                onClick={() => setCurrentView('workspace')}
                disabled={!selectedAccount}
              >
                <FolderKanban className="icon-sm" />
                <div>
                  <strong>Workspace</strong>
                </div>
              </button>
            </div>

          </div>
        </section>

        <section className="dashboard-grid secondary">
          <div className="panel">
            <div className="panel-head">
              <h2>Best Accounts</h2>
              <button
                className="button ghost small"
                type="button"
                onClick={() => setCurrentView('accounts')}
              >
                Xem tat ca
              </button>
            </div>

            <div className="recommendation-list">
              {sortedRecommendations.length === 0 ? (
                <div className="empty-panel compact">
                  <p>Chua co account nao de xep hang.</p>
                </div>
              ) : (
                sortedRecommendations.map((account) => (
                  <button
                    className="recommendation-row"
                    key={account.id}
                    type="button"
                    onClick={() => focusAccount(account.id, 'workspace')}
                  >
                    <div className="recommendation-main">
                      <strong>{displayAccountName(account)}</strong>
                      <span>{displayAccountEmail(account)}</span>
                    </div>
                    <div className="recommendation-side">
                      {account.isCodexActive ? (
                        <span className="badge tone-primary">Codex may</span>
                      ) : null}
                      <span className={`badge tone-${statusTone(account.status)}`}>
                        {account.status}
                      </span>
                      <strong>{accountScore(account)}</strong>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Renewals</h2>
            </div>

            <div className="renewal-stack">
              {appState.accounts
                .filter((account) => account.renewalDate)
                .sort((left, right) => {
                  const leftDays = daysUntil(left.renewalDate) ?? 9999
                  const rightDays = daysUntil(right.renewalDate) ?? 9999
                  return leftDays - rightDays
                })
                .slice(0, 5)
                .map((account) => (
                  <div className="renewal-row" key={account.id}>
                    <div>
                      <strong>{displayAccountName(account)}</strong>
                      <p>{formatDateLabel(account.renewalDate)}</p>
                    </div>
                    <span
                      className={`badge ${isRenewalSoon(account.renewalDate) ? 'tone-warning' : 'soft'}`}
                    >
                      {describeRenewal(account.renewalDate)}
                    </span>
                  </div>
                ))}

              {appState.accounts.every((account) => !account.renewalDate) ? (
                <div className="empty-panel compact">
                  <p>Chua dat renewal date cho account nao.</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    )
  }

  function renderAccountsToolbar() {
    return (
      <section className="panel toolbar-panel">
        <div className="toolbar-search">
          <Search className="icon-sm" />
          <input
            type="search"
            placeholder="email, repo, profile, tag..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="toolbar-filters">
          <label className="compact-field">
            <span>Plan</span>
            <select
              value={planFilter}
              onChange={(event) => setPlanFilter(event.target.value)}
            >
              <option value="all">Tat ca</option>
              {planOptions.map((plan) => (
                <option key={plan} value={plan}>
                  {plan}
                </option>
              ))}
            </select>
          </label>

          <label className="compact-field">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Tat ca</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="compact-field">
            <span>Platform</span>
            <select
              value={platformFilter}
              onChange={(event) => setPlatformFilter(event.target.value)}
            >
              <option value="all">Tat ca</option>
              {platformOptions.map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="toolbar-actions">
          <button
            className={`icon-toggle ${accountsViewMode === 'grid' ? 'active' : ''}`}
            type="button"
            onClick={() => setAccountsViewMode('grid')}
            aria-label="Grid view"
          >
            <Grid2x2 className="icon-sm" />
          </button>
          <button
            className={`icon-toggle ${accountsViewMode === 'list' ? 'active' : ''}`}
            type="button"
            onClick={() => setAccountsViewMode('list')}
            aria-label="List view"
          >
            <List className="icon-sm" />
          </button>
        </div>
      </section>
    )
  }

  function renderAccounts() {
    return (
      <div className="view-stack">
        {renderAccountsToolbar()}

        <section className="accounts-header">
          <div>
            <span className="eyebrow">Accounts</span>
            <h2>{filteredAccounts.length} slot dang hien thi</h2>
            <p>
              Chon mot account de mo session, dua vao workspace hoac reset cookie
              rieng.
            </p>
            {codexAccount ? (
              <p>{`Account dang chon cho profile Codex: ${displayAccountName(codexAccount)}.`}</p>
            ) : null}
          </div>
          <div className="header-inline-actions">
            <button className="button ghost" type="button" onClick={handleImport}>
              <Import className="icon-sm" />
              Import
            </button>
            <button className="button ghost" type="button" onClick={handleExport}>
              <Download className="icon-sm" />
              Export
            </button>
            <button className="button primary" type="button" onClick={addAccount}>
              <Plus className="icon-sm" />
              Tao moi
            </button>
          </div>
        </section>

        {filteredAccounts.length === 0 ? (
          <section className="panel empty-panel">
            <h3>Khong co account nao khop bo loc hien tai.</h3>
            <p>Thu bo bot filter hoac tao account moi.</p>
          </section>
        ) : accountsViewMode === 'grid' ? (
          <section className="accounts-grid">
            {filteredAccounts.map((account) => renderAccountMiniCard(account))}
          </section>
        ) : (
          <section className="panel table-panel">
            <div className="table-head">
              <span>Account</span>
              <span>Session</span>
              <span>Plan</span>
              <span>Platform</span>
              <span>Renewal</span>
              <span>Actions</span>
            </div>
            {filteredAccounts.map((account) => (
              <div className="table-row" key={account.id}>
                <button
                  className="row-main"
                  type="button"
                  onClick={() => focusAccount(account.id, 'workspace')}
                >
                  <strong>{displayAccountName(account)}</strong>
                  <span>{displayAccountEmail(account)}</span>
                </button>
                <div className="row-cell">
                  <span className={`badge tone-${statusTone(account.status)}`}>
                    {account.lastSessionOpenedAt ? 'Ready' : account.status}
                  </span>
                </div>
                <div className="row-cell">
                  {displayAccountPlan(account)}
                  {account.isCodexActive ? ' · Codex may' : ''}
                </div>
                <div className="row-cell">{platformLabel(account.platform)}</div>
                <div className="row-cell">{describeRenewal(account.renewalDate)}</div>
                <div className="row-actions">
                  <button
                    className="button ghost small"
                    type="button"
                    onClick={() => void handleSyncAccountSession(account)}
                  >
                    Sync
                  </button>
                  <button
                    className="button ghost small"
                    type="button"
                    onClick={() => focusAccount(account.id, 'workspace')}
                  >
                    Edit
                  </button>
                  <button
                    className="button secondary small"
                    type="button"
                    onClick={() => void handleOpenAccountSession(account)}
                  >
                    Open
                  </button>
                  <button
                    className="button secondary small"
                    type="button"
                    disabled={codexActionAccountId === account.id}
                    onClick={() => void handleCaptureMachineCodexAuth(account)}
                  >
                    {codexActionAccountId === account.id
                      ? 'Dang xu ly...'
                      : 'Kiem tra'}
                  </button>
                  <button
                    className="button secondary small"
                    type="button"
                    disabled={codexActionAccountId === account.id}
                    onClick={() => void handleSetCodexAccount(account)}
                  >
                    {codexActionAccountId === account.id
                      ? 'Dang chuyen...'
                      : 'Mo profile'}
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    )
  }

  function renderWorkspaceSummary(account: AccountRecord) {
    const isSyncBusy = syncingAccountId === account.id
    const isSessionBusy = sessionActionAccountId === account.id
    const isRenewalBusy = renewalActionAccountId === account.id
    const isUsageBusy = codexUsageActionAccountId === account.id
    const machineCodexProfilePath = resolveMachineCodexProfilePath(account, dataFilePath)
    const codexUsageSummary = summarizeCodexUsage(account)

    return (
      <section className="workspace-summary">
        <article className="panel summary-card">
          <div className="summary-head">
            <div>
              <span className="eyebrow">Focus Account</span>
              <h2>{displayAccountName(account)}</h2>
              <p>{displayAccountEmail(account)}</p>
            </div>
            <div className="summary-badges">
              {account.isCodexActive ? (
                <span className="badge tone-primary">Profile Codex dang mo</span>
              ) : null}
              <span className={`badge tone-${statusTone(account.status)}`}>
                {account.status}
              </span>
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-item">
              <span>Priority</span>
              <strong>{account.priority}</strong>
            </div>
            <div className="summary-item">
              <span>Plan</span>
              <strong>{displayAccountPlan(account)}</strong>
            </div>
            <div className="summary-item">
              <span>Partition</span>
              <strong>{getAccountPartition(account.id)}</strong>
            </div>
            <div className="summary-item">
              <span>Last session</span>
              <strong>
                {account.lastSessionOpenedAt
                  ? formatCompactDateTime(account.lastSessionOpenedAt)
                  : 'Chua mo'}
              </strong>
            </div>
            <div className="summary-item">
              <span>Last sync</span>
              <strong>
                {account.lastSyncedAt
                  ? formatCompactDateTime(account.lastSyncedAt)
                  : 'Chua sync'}
              </strong>
            </div>
            <div className="summary-item">
              <span>Gia han</span>
              <strong>{formatDateLabel(account.renewalDate)}</strong>
              {account.renewalDate ? (
                <small>{describeRenewal(account.renewalDate)}</small>
              ) : (
                <small>Co the bam Sync gia han de dien tu dong.</small>
              )}
            </div>
            <div className="summary-item">
              <span>Codex profile</span>
              <strong>
                {account.machineCodexAuthCapturedAt
                  ? formatCompactDateTime(account.machineCodexAuthCapturedAt)
                  : 'Chua chup'}
              </strong>
            </div>
            <div className="summary-item">
              <span>Codex {account.codexUsage?.primary?.windowMinutes
                ? formatWindowMinutes(account.codexUsage.primary.windowMinutes)
                : 'usage'}</span>
              <strong>{describeCodexUsageWindow(account.codexUsage?.primary)}</strong>
              {codexUsageSummary ? <small>{codexUsageSummary}</small> : null}
            </div>
            <div className="summary-item">
              <span>Reset usage</span>
              <strong>
                {account.codexUsage?.primary?.resetsAt
                  ? formatCompactDateTime(account.codexUsage.primary.resetsAt)
                  : 'Chua doc'}
              </strong>
            </div>
            <div className="summary-item">
              <span>Credits</span>
              <strong>{account.codexUsage?.creditsSummary || 'Chua co'}</strong>
            </div>
            <div className="summary-item">
              <span>Profile account</span>
              <strong>{describeMachineCodexSnapshot(account)}</strong>
              {!account.machineCodexAuthAccountId && hasMachineCodexSnapshot(account) ? (
                <small>Bam Kiem tra profile lai de nhan dien account_id cua slot.</small>
              ) : null}
            </div>
            <div className="summary-item">
              <span>Profile path</span>
              <strong>{machineCodexProfilePath || 'Chua xac dinh'}</strong>
              {account.isCodexActive && machineCodexProfilePath ? (
                <small>Profile dang active tren may nay.</small>
              ) : null}
            </div>
            <div className="summary-item">
              <span>Codex workspace</span>
              <strong>{resolveMachineCodexWorkspace(account) || 'Chua dat'}</strong>
            </div>
          </div>

          <div className="summary-actions">
            <button
              className="button secondary"
              type="button"
              disabled={codexActionAccountId === account.id}
              onClick={() => void handleCaptureMachineCodexAuth(account)}
            >
              <Copy className="icon-sm" />
              {codexActionAccountId === account.id
                ? 'Dang xu ly...'
                : 'Kiem tra profile'}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={isSyncBusy}
              onClick={() => void handleSyncAccountSession(account)}
            >
              <RefreshCcw className="icon-sm" />
              {isSyncBusy ? 'Dang sync...' : 'Sync tai khoan'}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={isUsageBusy}
              onClick={() => void handleReadMachineCodexUsage(account)}
            >
              <Clock3 className="icon-sm" />
              {isUsageBusy ? 'Dang doc usage...' : 'Sync usage Codex'}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={isRenewalBusy}
              onClick={() => void handleSyncRenewalDate(account)}
            >
              <RefreshCcw className="icon-sm" />
              {isRenewalBusy ? 'Dang doc gia han...' : 'Sync gia han'}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={isSessionBusy}
              onClick={() => void handleOpenBillingCenter(account)}
            >
              <CreditCard className="icon-sm" />
              Billing
            </button>
            <button
              className="button primary"
              type="button"
              disabled={isSessionBusy}
              onClick={() => void handleOpenAccountSession(account)}
            >
              <Play className="icon-sm" />
              {isSessionBusy ? 'Dang mo...' : 'Mo session'}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={codexActionAccountId === account.id}
              onClick={() => void handleSetCodexAccount(account)}
            >
              <Sparkles className="icon-sm" />
              {codexActionAccountId === account.id
                ? 'Dang chuyen...'
                : account.isCodexActive
                  ? 'Profile dang mo'
                  : 'Mo profile Codex'}
            </button>
            <button
              className="button ghost"
              type="button"
              onClick={() => void handleOpenMachineCodexProfileFolder(account)}
            >
              <FolderOpen className="icon-sm" />
              Open profile folder
            </button>
            <button
              className="button ghost"
              type="button"
              disabled={isSessionBusy}
              onClick={() => void handleResetAccountSession(account)}
            >
              <RefreshCcw className="icon-sm" />
              Reset
            </button>
            <button
              className="button ghost"
              type="button"
              onClick={() => copyText(getAccountPartition(account.id), 'partition')}
            >
              <Copy className="icon-sm" />
              Copy partition
            </button>
            <button
              className="button ghost"
              type="button"
              disabled={diagnoseAccountId === account.id}
              onClick={() => void handleDiagnoseCodexAuth(account)}
            >
              <Search className="icon-sm" />
              {diagnoseAccountId === account.id ? 'Dang chan doan...' : 'Diagnostics'}
            </button>
          </div>
        </article>

        <article className="panel side-card">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Quick Notes</span>
              <h3>Huong dan su dung</h3>
            </div>
          </div>

          <ol className="guide-list">
            <li>Mo session rieng cho account.</li>
            <li>Dang nhap ChatGPT/Codex trong cua so do.</li>
            <li>Bam Sync de doc email, ten va goi tu session vua luu.</li>
            <li>Bam Mo profile Codex de mo Codex local theo profile rieng cua slot da chon.</li>
            <li>Neu slot chua co profile, dang nhap trong Codex vua mo roi bam Kiem tra profile de xac nhan cho lan doi sau.</li>
          </ol>
        </article>
      </section>
    )
  }

  function renderWorkspace() {
    if (!selectedAccount) {
      return (
        <section className="panel empty-panel">
          <h3>Chua co account dang focus.</h3>
          <p>Chon mot account tu Dashboard hoac Account Center.</p>
        </section>
      )
    }

    const machineCodexProfilePath = resolveMachineCodexProfilePath(
      selectedAccount,
      dataFilePath,
    )
    const activeCodexProfilePath = codexAccount
      ? resolveMachineCodexProfilePath(codexAccount, dataFilePath)
      : ''
    const mismatchedCodexAccount =
      codexAccount && codexAccount.id !== selectedAccount.id ? codexAccount : null
    const isUsageBusy = codexUsageActionAccountId === selectedAccount.id
    const isRenewalBusy = renewalActionAccountId === selectedAccount.id
    const codexUsageSummary = summarizeCodexUsage(selectedAccount)

    return (
      <div className="view-stack">
        {renderWorkspaceSummary(selectedAccount)}

        {mismatchedCodexAccount ? (
          <section className="notice-banner guard-banner">
            <CircleAlert className="icon-sm" />
            <div className="guard-copy">
              <strong>Profile Codex dang active khong trung voi slot dang focus.</strong>
              <span>
                {`Hien dang mo profile cua ${displayAccountName(mismatchedCodexAccount)}${
                  activeCodexProfilePath ? ` (${activeCodexProfilePath})` : ''
                }. Ban dang xem slot ${displayAccountName(selectedAccount)}${
                  machineCodexProfilePath ? ` (${machineCodexProfilePath})` : ''
                }.`}
              </span>
            </div>
            <div className="header-inline-actions">
              <button
                className="button secondary small"
                type="button"
                disabled={codexActionAccountId === selectedAccount.id}
                onClick={() => void handleSetCodexAccount(selectedAccount)}
              >
                <Sparkles className="icon-sm" />
                {codexActionAccountId === selectedAccount.id
                  ? 'Dang chuyen...'
                  : 'Chuyen sang slot nay'}
              </button>
              <button
                className="button ghost small"
                type="button"
                onClick={() => focusAccount(mismatchedCodexAccount.id, 'workspace')}
              >
                <FolderKanban className="icon-sm" />
                Mo slot dang active
              </button>
            </div>
          </section>
        ) : null}

        <section className="workspace-editor">
          <div className="panel editor-column">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Session</span>
                <h2>Session rieng</h2>
              </div>
              <div className="header-inline-actions">
                <button
                  className="button primary small"
                  type="button"
                  disabled={sessionActionAccountId === selectedAccount.id}
                  onClick={() => void handleOpenAccountSession(selectedAccount)}
                >
                  <Play className="icon-sm" />
                  {sessionActionAccountId === selectedAccount.id ? 'Dang mo...' : 'Open'}
                </button>
                <button
                  className="button secondary small"
                  type="button"
                  disabled={syncingAccountId === selectedAccount.id}
                  onClick={() => void handleSyncAccountSession(selectedAccount)}
                >
                  <RefreshCcw className="icon-sm" />
                  {syncingAccountId === selectedAccount.id ? 'Dang sync...' : 'Sync'}
                </button>
                <button
                  className="button ghost small"
                  type="button"
                  disabled={sessionActionAccountId === selectedAccount.id}
                  onClick={() => void handleResetAccountSession(selectedAccount)}
                >
                  <RefreshCcw className="icon-sm" />
                  Reset
                </button>
              </div>
            </div>

            <div className="field-grid">
              <label className="field span-2">
                <span>Start URL</span>
                <input
                  value={selectedAccount.sessionStartUrl}
                  placeholder="https://chatgpt.com/"
                  onChange={(event) =>
                    updateSelectedAccount((account) => ({
                      ...account,
                      sessionStartUrl: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="info-box">
                <span>Partition</span>
                <code>{getAccountPartition(selectedAccount.id)}</code>
              </div>
              <div className="info-box">
                <span>Session opened</span>
                <strong>
                  {selectedAccount.lastSessionOpenedAt
                    ? formatCompactDateTime(selectedAccount.lastSessionOpenedAt)
                    : 'Chua mo'}
                </strong>
              </div>
              <div className="info-box">
                <span>Last sync</span>
                <strong>
                  {selectedAccount.lastSyncedAt
                    ? formatCompactDateTime(selectedAccount.lastSyncedAt)
                    : 'Chua sync'}
                </strong>
              </div>
            </div>
          </div>

          <div className="panel editor-column">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Profile</span>
                <h2>Thong tin co ban</h2>
              </div>
              <div className="header-inline-actions">
                <button
                  className="button ghost small"
                  type="button"
                  onClick={() =>
                    copyText(displayAccountEmail(selectedAccount), 'email')
                  }
                >
                  <Copy className="icon-sm" />
                  Copy email
                </button>
                <button
                  className="button secondary small"
                  type="button"
                  disabled={codexActionAccountId === selectedAccount.id}
                  onClick={() => void handleCaptureMachineCodexAuth(selectedAccount)}
                >
                  <Copy className="icon-sm" />
                  {codexActionAccountId === selectedAccount.id
                    ? 'Dang xu ly...'
                    : 'Kiem tra profile'}
                </button>
                <button
                  className="button secondary small"
                  type="button"
                  disabled={codexActionAccountId === selectedAccount.id}
                  onClick={() => void handleSetCodexAccount(selectedAccount)}
                >
                  <Sparkles className="icon-sm" />
                  {codexActionAccountId === selectedAccount.id
                    ? 'Dang chuyen...'
                    : 'Mo profile Codex'}
                </button>
                <button
                  className="button secondary small"
                  type="button"
                  disabled={isUsageBusy}
                  onClick={() => void handleReadMachineCodexUsage(selectedAccount)}
                >
                  <Clock3 className="icon-sm" />
                  {isUsageBusy ? 'Dang doc usage...' : 'Sync usage'}
                </button>
                <button
                  className="button secondary small"
                  type="button"
                  disabled={isRenewalBusy}
                  onClick={() => void handleSyncRenewalDate(selectedAccount)}
                >
                  <RefreshCcw className="icon-sm" />
                  {isRenewalBusy ? 'Dang doc gia han...' : 'Sync gia han'}
                </button>
                <button
                  className="button secondary small"
                  type="button"
                  disabled={sessionActionAccountId === selectedAccount.id}
                  onClick={() => void handleOpenBillingCenter(selectedAccount)}
                >
                  <CreditCard className="icon-sm" />
                  Billing
                </button>
                <button
                  className="button ghost small"
                  type="button"
                  onClick={() => void handleOpenMachineCodexProfileFolder(selectedAccount)}
                >
                  <FolderOpen className="icon-sm" />
                  Open profile folder
                </button>
                <button
                  className="button secondary small"
                  type="button"
                  onClick={duplicateSelectedAccount}
                >
                  Duplicate
                </button>
                <button
                  className="button danger small"
                  type="button"
                  onClick={deleteSelectedAccount}
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="field-grid sync-grid">
              <div className="info-box">
                <span>Synced name</span>
                <strong>{selectedAccount.syncedName || 'Chua co'}</strong>
              </div>
              <div className="info-box">
                <span>Synced email</span>
                <strong>{selectedAccount.syncedEmail || 'Chua co'}</strong>
              </div>
              <div className="info-box">
                <span>Synced plan</span>
                <strong>{selectedAccount.syncedPlan || 'Chua nhan dien'}</strong>
              </div>
              <div className="info-box">
                <span>Workspace</span>
                <strong>
                  {selectedAccount.syncedWorkspaceName || 'Chua nhan dien'}
                </strong>
              </div>
              <div className="info-box">
                <span>Codex profile</span>
                <strong>
                  {selectedAccount.machineCodexAuthCapturedAt
                    ? formatCompactDateTime(selectedAccount.machineCodexAuthCapturedAt)
                    : 'Chua chup'}
                </strong>
                {!selectedAccount.machineCodexAuthAccountId &&
                hasMachineCodexSnapshot(selectedAccount) ? (
                  <small>Bam Kiem tra profile lai de cap nhat fingerprint cho slot nay.</small>
                ) : null}
              </div>
              <div className="info-box">
                <span>Profile account</span>
                <strong>{describeMachineCodexSnapshot(selectedAccount)}</strong>
              </div>
              <div className="info-box">
                <span>Profile path</span>
                <strong>{machineCodexProfilePath || 'Chua xac dinh'}</strong>
                {selectedAccount.isCodexActive && machineCodexProfilePath ? (
                  <small>Day la profile Codex dang active tren may nay.</small>
                ) : null}
              </div>
              <div className="info-box">
                <span>Codex workspace</span>
                <strong>
                  {resolveMachineCodexWorkspace(selectedAccount) || 'Chua dat'}
                </strong>
              </div>
              <div className="info-box">
                <span>Codex 5h</span>
                <strong>{describeCodexUsageWindow(selectedAccount.codexUsage?.primary)}</strong>
                {codexUsageSummary ? <small>{codexUsageSummary}</small> : null}
              </div>
              <div className="info-box">
                <span>Reset 5h</span>
                <strong>
                  {selectedAccount.codexUsage?.primary?.resetsAt
                    ? formatCompactDateTime(selectedAccount.codexUsage.primary.resetsAt)
                    : 'Chua doc'}
                </strong>
              </div>
              <div className="info-box">
                <span>Codex 7d</span>
                <strong>{describeCodexUsageWindow(selectedAccount.codexUsage?.secondary)}</strong>
              </div>
              <div className="info-box">
                <span>Credits</span>
                <strong>{selectedAccount.codexUsage?.creditsSummary || 'Chua co'}</strong>
              </div>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>Ten hien thi</span>
                <input
                  value={selectedAccount.label}
                  onChange={(event) =>
                    updateSelectedAccount((account) => ({
                      ...account,
                      label: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>Email</span>
                <input
                  value={selectedAccount.email}
                  placeholder={selectedAccount.syncedEmail || 'Email tu session'}
                  onChange={(event) =>
                    updateSelectedAccount((account) => ({
                      ...account,
                      email: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>Plan</span>
                <select
                  value={selectedAccount.plan}
                  onChange={(event) =>
                    updateSelectedAccount((account) => ({
                      ...account,
                      plan: event.target.value as AccountRecord['plan'],
                    }))
                  }
                >
                  {planOptions.map((plan) => (
                    <option key={plan} value={plan}>
                      {plan}
                    </option>
                  ))}
                </select>
                {selectedAccount.syncedPlan ? (
                  <small className="field-hint">
                    Session dang bao cao: {selectedAccount.syncedPlan}
                  </small>
                ) : null}
              </label>

              <label className="field">
                <span>Status</span>
                <select
                  value={selectedAccount.status}
                  onChange={(event) =>
                    updateSelectedAccount((account) => ({
                      ...account,
                      status: event.target.value as AccountRecord['status'],
                    }))
                  }
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Priority</span>
                <select
                  value={selectedAccount.priority}
                  onChange={(event) =>
                    updateSelectedAccount((account) => ({
                      ...account,
                      priority: event.target.value as AccountRecord['priority'],
                    }))
                  }
                >
                  {priorityOptions.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Platform</span>
                <select
                  value={selectedAccount.platform}
                  onChange={(event) =>
                    updateSelectedAccount((account) => ({
                      ...account,
                      platform: event.target.value as AccountRecord['platform'],
                    }))
                  }
                >
                  {platformOptions.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Surface</span>
                <select
                  value={selectedAccount.codexSurface}
                  onChange={(event) =>
                    updateSelectedAccount((account) => ({
                      ...account,
                      codexSurface:
                        event.target.value as AccountRecord['codexSurface'],
                    }))
                  }
                >
                  {codexSurfaceOptions.map((surface) => (
                    <option key={surface} value={surface}>
                      {surface}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field span-2">
                <span>Workspace mo voi profile Codex</span>
                <input
                  value={selectedAccount.machineCodexWorkspacePath}
                  placeholder={
                    selectedAccount.repositories[0]?.path || '/duong-dan/project'
                  }
                  onChange={(event) =>
                    updateSelectedAccount((account) => ({
                      ...account,
                      machineCodexWorkspacePath: event.target.value,
                    }))
                  }
                />
                <small className="field-hint">
                  De trong thi app se dung repo dau tien co path.
                </small>
              </label>

              <label className="field">
                <span>Gia han</span>
                <div className="inline-action">
                  <input
                    type="date"
                    value={selectedAccount.renewalDate}
                    onChange={(event) =>
                      updateSelectedAccount((account) => ({
                        ...account,
                        renewalDate: event.target.value,
                      }))
                    }
                  />
                  <button
                    className="button ghost small"
                    type="button"
                    disabled={isRenewalBusy}
                    onClick={() => void handleSyncRenewalDate(selectedAccount)}
                  >
                    <RefreshCcw className="icon-sm" />
                    {isRenewalBusy ? 'Dang doc...' : 'Sync'}
                  </button>
                </div>
                <small className="field-hint">
                  App se thu doc ngay gia han tu session ChatGPT cua slot nay va tu
                  dong dien vao o tren.
                </small>
              </label>

              <label className="field">
                <span>Lan dung cuoi</span>
                <input
                  type="date"
                  value={selectedAccount.lastUsedAt}
                  onChange={(event) =>
                    updateSelectedAccount((account) => ({
                      ...account,
                      lastUsedAt: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>Browser profile</span>
                <input
                  value={selectedAccount.browserProfile}
                  placeholder="Chrome Profile 3"
                  onChange={(event) =>
                    updateSelectedAccount((account) => ({
                      ...account,
                      browserProfile: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field span-2">
                <span>Profile path</span>
                <div className="inline-action">
                  <input
                    value={selectedAccount.profilePath}
                    placeholder="/Users/.../Chrome/Profile 3"
                    onChange={(event) =>
                      updateSelectedAccount((account) => ({
                        ...account,
                        profilePath: event.target.value,
                      }))
                    }
                  />
                  <button
                    className="button ghost small"
                    type="button"
                    onClick={() =>
                      handleOpenPath(selectedAccount.profilePath, 'browser profile path')
                    }
                    disabled={!selectedAccount.profilePath.trim()}
                  >
                    <FolderOpen className="icon-sm" />
                    Open
                  </button>
                </div>
              </label>

              <label className="field span-2">
                <span>Launch command</span>
                <textarea
                  rows={3}
                  value={selectedAccount.launchCommand}
                  placeholder='vi du: open -na "Google Chrome" --args --profile-directory="Profile 3"'
                  onChange={(event) =>
                    updateSelectedAccount((account) => ({
                      ...account,
                      launchCommand: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          </div>
        </section>

        <section className="workspace-editor">
          <div className="panel editor-column">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Operations</span>
                <h2>Tags va ghi chu</h2>
              </div>
            </div>

            <div className="field-grid">
              <label className="field span-2">
                <span>Tags</span>
                <input
                  value={selectedAccount.tags.join(', ')}
                  placeholder="plus, backup, mac-mini"
                  onChange={(event) =>
                    updateSelectedAccount((account) => ({
                      ...account,
                      tags: parseTags(event.target.value),
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>Budget / note limit</span>
                <input
                  value={selectedAccount.monthlyBudget}
                  placeholder="Cap usage cho sprint nay"
                  onChange={(event) =>
                    updateSelectedAccount((account) => ({
                      ...account,
                      monthlyBudget: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>Muc dich chinh</span>
                <input
                  value={selectedAccount.usagePattern}
                  placeholder="Review PR va bugfix"
                  onChange={(event) =>
                    updateSelectedAccount((account) => ({
                      ...account,
                      usagePattern: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field span-2">
                <span>Ghi chu</span>
                <textarea
                  rows={6}
                  value={selectedAccount.notes}
                  placeholder="Luu y ve OTP, quota, project gan voi account nay..."
                  onChange={(event) =>
                    updateSelectedAccount((account) => ({
                      ...account,
                      notes: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          </div>

          <div className="panel editor-column">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Repositories</span>
                <h2>Repo gan voi account</h2>
              </div>
              <button
                className="button secondary small"
                type="button"
                onClick={addRepository}
              >
                <Plus className="icon-sm" />
                Them repo
              </button>
            </div>

            {selectedAccount.repositories.length === 0 ? (
              <div className="empty-panel compact">
                <p>Chua co repo nao gan voi account nay.</p>
              </div>
            ) : (
              <div className="repo-stack">
                {selectedAccount.repositories.map((repository) => (
                  <article className="repo-card" key={repository.id}>
                    <div className="repo-grid">
                      <label className="field">
                        <span>Ten repo</span>
                        <input
                          value={repository.name}
                          onChange={(event) =>
                            updateRepository(repository.id, 'name', event.target.value)
                          }
                        />
                      </label>

                      <label className="field">
                        <span>Branch mac dinh</span>
                        <input
                          value={repository.branch}
                          onChange={(event) =>
                            updateRepository(repository.id, 'branch', event.target.value)
                          }
                        />
                      </label>

                      <label className="field span-2">
                        <span>Path</span>
                        <div className="inline-action">
                          <input
                            value={repository.path}
                            placeholder="/Users/.../repo"
                            onChange={(event) =>
                              updateRepository(repository.id, 'path', event.target.value)
                            }
                          />
                          <button
                            className="button ghost small"
                            type="button"
                            onClick={() =>
                              handleOpenPath(repository.path, repository.name || 'repo')
                            }
                            disabled={!repository.path.trim()}
                          >
                            <FolderOpen className="icon-sm" />
                            Open
                          </button>
                        </div>
                      </label>

                      <label className="field span-2">
                        <span>Muc dich</span>
                        <input
                          value={repository.purpose}
                          placeholder="frontend bugfix, batch review..."
                          onChange={(event) =>
                            updateRepository(repository.id, 'purpose', event.target.value)
                          }
                        />
                      </label>
                    </div>

                    <div className="repo-actions">
                      <button
                        className="button danger small"
                        type="button"
                        onClick={() => removeRepository(repository.id)}
                      >
                        Delete repo
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    )
  }

  function renderBackups() {
    if (!selectedAccount) {
      return (
        <section className="panel empty-panel">
          <h3>Chua co slot de gan backup.</h3>
          <p>Chon mot account, sau do import file export ChatGPT cho slot do.</p>
        </section>
      )
    }

    const accountBackupDirectory = resolveAccountChatBackupPath(
      selectedAccount,
      dataFilePath,
    )
    const totalBackupConversations = selectedAccountBackups.reduce(
      (sum, backup) => sum + backup.conversationCount,
      0,
    )
    const totalBackupMessages = selectedAccountBackups.reduce(
      (sum, backup) => sum + backup.messageCount,
      0,
    )
    const isBackupBusy = backupActionAccountId === selectedAccount.id

    return (
      <div className="view-stack">
        <section className="settings-grid">
          <article className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Focused Slot</span>
                <h2>Kho backup local</h2>
                <p>{displayAccountName(selectedAccount)}</p>
              </div>
            </div>

            <div className="summary-grid">
              <div className="summary-item">
                <span>Imported files</span>
                <strong>{selectedAccountBackups.length}</strong>
              </div>
              <div className="summary-item">
                <span>Conversations</span>
                <strong>{totalBackupConversations}</strong>
              </div>
              <div className="summary-item">
                <span>Messages</span>
                <strong>{totalBackupMessages}</strong>
              </div>
              <div className="summary-item">
                <span>Backup folder</span>
                <strong>{accountBackupDirectory || 'Chua xac dinh'}</strong>
              </div>
            </div>

            <div className="summary-actions">
              <button
                className="button primary"
                type="button"
                disabled={isBackupBusy}
                onClick={() => void handleImportChatBackup(selectedAccount)}
              >
                <HardDriveDownload className="icon-sm" />
                {isBackupBusy ? 'Dang import...' : 'Import export ChatGPT'}
              </button>
              <button
                className="button ghost"
                type="button"
                onClick={() => void handleOpenChatBackupFolder(selectedAccount)}
              >
                <FolderOpen className="icon-sm" />
                Mo thu muc backup
              </button>
            </div>

            <ol className="guide-list">
              <li>Trong ChatGPT, request Data Export cho account can sao luu.</li>
              <li>Sau khi nhan email, tai file `.zip` ve may.</li>
              <li>Import file `.zip` hoac `conversations.json` vao slot nay.</li>
              <li>App se luu mot ban archive local rieng de tra cuu va sao chep.</li>
            </ol>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Imported Backups</span>
                <h2>Danh sach file da nap</h2>
              </div>
            </div>

            {selectedAccountBackups.length === 0 ? (
              <section className="empty-panel compact">
                <h3>Chua co backup nao.</h3>
                <p>Import file export cua OpenAI de bat dau luu kho local.</p>
              </section>
            ) : (
              <div className="backup-record-list">
                {selectedAccountBackups.map((backup) => (
                  <button
                    key={backup.id}
                    className={`backup-record ${
                      selectedBackupRecord?.id === backup.id ? 'is-active' : ''
                    }`}
                    type="button"
                    onClick={() => setSelectedBackupId(backup.id)}
                  >
                    <div className="backup-record-head">
                      <strong>{backup.sourceFileName}</strong>
                      <span>{formatCompactDateTime(backup.importedAt)}</span>
                    </div>
                    <p>{`${backup.conversationCount} chats · ${backup.messageCount} messages`}</p>
                    {backup.titleSamples.length > 0 ? (
                      <small>{backup.titleSamples.join(' · ')}</small>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </article>
        </section>

        {selectedBackupRecord ? (
          <section className="workspace-editor">
            <article className="panel editor-column">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Conversations</span>
                  <h2>{selectedBackupRecord.sourceFileName}</h2>
                  <p>{`${selectedBackupRecord.conversationCount} chats tu ${formatCompactDateTime(
                    selectedBackupRecord.importedAt,
                  )}`}</p>
                </div>
              </div>

              <label className="toolbar-search backup-search">
                <Search className="icon-sm" />
                <input
                  value={backupSearch}
                  placeholder="Tim theo title, message, participant..."
                  onChange={(event) => setBackupSearch(event.target.value)}
                />
              </label>

              {backupLoadStatus === 'loading' ? (
                <section className="empty-panel compact">
                  <h3>Dang nap backup.</h3>
                  <p>App dang doc noi dung conversation tu kho local.</p>
                </section>
              ) : backupLoadStatus === 'error' ? (
                <section className="empty-panel compact">
                  <h3>Khong doc duoc backup.</h3>
                  <p>Thu import lai file export hoac kiem tra thu muc backup local.</p>
                </section>
              ) : filteredBackupConversations.length === 0 ? (
                <section className="empty-panel compact">
                  <h3>Khong co ket qua phu hop.</h3>
                  <p>Thu doi tu khoa tim kiem hoac chon file backup khac.</p>
                </section>
              ) : (
                <div className="backup-conversation-list">
                  {filteredBackupConversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      className={`backup-conversation-card ${
                        selectedBackupConversation?.id === conversation.id
                          ? 'is-active'
                          : ''
                      }`}
                      type="button"
                      onClick={() => setSelectedConversationId(conversation.id)}
                    >
                      <div className="backup-record-head">
                        <strong>{conversation.title}</strong>
                        <span>{conversation.messageCount} msg</span>
                      </div>
                      <p>{conversation.preview || 'Khong co preview.'}</p>
                      <small>
                        {(conversation.participants.join(' · ') || 'unknown')} ·{' '}
                        {formatCompactDateTime(
                          conversation.updatedAt || conversation.createdAt,
                        )}
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </article>

            <article className="panel editor-column">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Preview</span>
                  <h2>{selectedBackupConversation?.title || 'Chua chon chat'}</h2>
                </div>
              </div>

              {selectedBackupConversation ? (
                <div className="backup-message-list">
                  {selectedBackupConversation.messages.map((message) => (
                    <article key={message.id} className="backup-message-card">
                      <div className="backup-record-head">
                        <strong>{message.author}</strong>
                        <span>{formatCompactDateTime(message.createdAt, 'Khong ro')}</span>
                      </div>
                      <pre>{message.text}</pre>
                    </article>
                  ))}
                </div>
              ) : (
                <section className="empty-panel compact">
                  <h3>Chua co conversation duoc chon.</h3>
                  <p>Chon mot chat o cot ben trai de xem noi dung.</p>
                </section>
              )}
            </article>
          </section>
        ) : (
          <section className="empty-panel">
            <h3>Chua co backup nao dang duoc mo.</h3>
            <p>Import mot file export ChatGPT hoac chon backup da co trong danh sach.</p>
          </section>
        )}
      </div>
    )
  }

  function renderSettings() {
    return (
      <div className="view-stack">
        <section className="settings-grid">
          <article className="panel">
            <div className="panel-head">
              <h2>Storage</h2>
            </div>

            <div className="settings-stack">
              <div className="settings-row">
                <span>Save status</span>
                <strong>{saveStatusLabel(saveStatus)}</strong>
              </div>
              <div className="settings-row">
                <span>Data file</span>
                <code>{dataFilePath || 'Dang khoi tao...'}</code>
              </div>
              <div className="settings-row">
                <span>App version</span>
                <strong>{appVersion || 'Dang khoi tao...'}</strong>
              </div>
              <div className="settings-row">
                <span>Update</span>
                <strong>{formatUpdateStatusLabel(updateStatus)}</strong>
              </div>
              <div className="settings-row">
                <span>Language</span>
                <strong>{languageLabels[currentLanguage]}</strong>
              </div>
              <div className="settings-row">
                <span>Theme</span>
                <strong>{currentTheme === 'dark' ? 'Dark' : 'Light'}</strong>
              </div>
            </div>

            <div className="summary-actions">
              <button
                className="button ghost"
                type="button"
                onClick={handleOpenDataDirectory}
              >
                <FolderOpen className="icon-sm" />
                Mo thu muc
              </button>
              <button className="button ghost" type="button" onClick={handleExport}>
                <Download className="icon-sm" />
                Export
              </button>
              <button className="button ghost" type="button" onClick={handleImport}>
                <Import className="icon-sm" />
                Import
              </button>
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h2>Usage Guide</h2>
            </div>

            <ul className="settings-list">
              <li>
                <CheckCircle2 className="icon-sm" />
                <span>Tao mot account record cho tung tai khoan ChatGPT Plus.</span>
              </li>
              <li>
                <CheckCircle2 className="icon-sm" />
                <span>Gan repo, profile path va launch command cho tung slot.</span>
              </li>
              <li>
                <CheckCircle2 className="icon-sm" />
                <span>Mo session rieng va dang nhap thu cong mot lan.</span>
              </li>
              <li>
                <CheckCircle2 className="icon-sm" />
                <span>Trong Codex local, login tung account 1 lan trong dung profile cua slot roi bam Kiem tra profile.</span>
              </li>
              <li>
                <CheckCircle2 className="icon-sm" />
                <span>Dung Dashboard de mo lai Codex bang profile account can dung, khong can dang nhap lai.</span>
              </li>
              <li>
                <CheckCircle2 className="icon-sm" />
                <span>Dong cua so chinh de app tiep tuc chay nen; muon tat han thi mo tray/menu bar va chon Thoat.</span>
              </li>
            </ul>
          </article>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Status Board</h2>
          </div>

          <div className="status-board">
            <div className="status-column">
              <span>Active</span>
              <strong>{statusBreakdown.active}</strong>
            </div>
            <div className="status-column">
              <span>Needs login</span>
              <strong>{statusBreakdown.needsLogin}</strong>
            </div>
            <div className="status-column">
              <span>Cooling</span>
              <strong>{statusBreakdown.cooling}</strong>
            </div>
            <div className="status-column">
              <span>Archived</span>
              <strong>{statusBreakdown.archived}</strong>
            </div>
          </div>
        </section>

        <section className="settings-grid">
          <article className="panel">
            <div className="panel-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img
                  src={appIconImage}
                  alt="Codex Desk"
                  style={{ width: 48, height: 48, borderRadius: 12 }}
                />
                <div>
                  <h2 style={{ margin: 0, fontSize: '1rem' }}>Codex Desk</h2>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)' }}>
                    {appVersion ? `v${appVersion}` : ''} · ChatGPT Plus Account Manager
                  </span>
                </div>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Support</span>
                <h2>Ung ho tac gia</h2>
              </div>
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-soft)', margin: '0 0 10px' }}>
              Neu app huu ich, ban co the ung ho tac gia qua cac kenh ben duoi.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <div className="info-box" style={{ textAlign: 'center', padding: '12px' }}>
                <strong style={{ fontSize: '0.78rem', marginBottom: '8px', display: 'block' }}>
                  Chuyen khoan ngan hang (VietQR)
                </strong>
                <img
                  src={qrTimoImage}
                  alt="Timo QR"
                  style={{ width: '100%', maxWidth: 200, borderRadius: 8, margin: '0 auto', display: 'block' }}
                />
                <small style={{ display: 'block', marginTop: '6px', color: 'var(--text-soft)' }}>
                  DO TAI - Timo Digital Bank by BVBank
                </small>
              </div>
              <div className="info-box" style={{ textAlign: 'center', padding: '12px' }}>
                <strong style={{ fontSize: '0.78rem', marginBottom: '8px', display: 'block' }}>
                  Binance Pay
                </strong>
                <img
                  src={qrBinanceImage}
                  alt="Binance Pay QR"
                  style={{ width: '100%', maxWidth: 220, borderRadius: 8, margin: '0 auto', display: 'block' }}
                />
                <small style={{ display: 'block', marginTop: '6px', color: 'var(--text-soft)' }}>
                  Nickname: Do Tai
                </small>
              </div>
            </div>
            <p style={{ fontSize: '0.72rem', textAlign: 'center', color: 'var(--text-soft)', marginTop: '10px' }}>
              Cam on su ung ho cua ban!
            </p>
          </article>
        </section>
      </div>
    )
  }

  function renderCurrentView() {
    if (currentView === 'dashboard') return renderDashboard()
    if (currentView === 'accounts') return renderAccounts()
    if (currentView === 'workspace') return renderWorkspace()
    if (currentView === 'backups') return renderBackups()
    return renderSettings()
  }

  return (
    <div className="shell">
      <nav className="topnav">
        <div className="topnav-brand">
          <img
            src={appIconImage}
            alt="Codex Desk"
            style={{ width: 22, height: 22, borderRadius: 5 }}
          />
          <strong>Codex Desk</strong>
        </div>

        <div className="topnav-tabs">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`topnav-tab ${currentView === item.id ? 'is-active' : ''}`}
                type="button"
                onClick={() => setCurrentView(item.id)}
              >
                <Icon className="icon-sm" />
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="topnav-spacer" />

        <div className="topnav-status">
          <div className={`save-pill status-${saveStatus}`}>
            <span className="save-dot" />
          </div>
          {saveStatusLabel(saveStatus)}
        </div>

        <div className="topnav-actions">
          <label className="topnav-select" data-no-localize>
            <Languages className="icon-sm" />
            <select
              aria-label={translateMessage('Language', currentLanguage)}
              value={currentLanguage}
              onChange={(event) =>
                updatePreferences((current) => ({
                  ...current,
                  language: event.target.value as AppState['preferences']['language'],
                }))
              }
            >
              {appLanguages.map((language) => (
                <option key={language} value={language}>
                  {languageLabels[language]}
                </option>
              ))}
            </select>
          </label>

          <label className="topnav-select" data-no-localize>
            {currentTheme === 'dark' ? (
              <MoonStar className="icon-sm" />
            ) : (
              <SunMedium className="icon-sm" />
            )}
            <select
              aria-label={translateMessage('Theme', currentLanguage)}
              value={currentTheme}
              onChange={(event) =>
                updatePreferences((current) => ({
                  ...current,
                  theme: event.target.value as AppState['preferences']['theme'],
                }))
              }
            >
              {themeModes.map((theme) => (
                <option key={theme} value={theme}>
                  {translateMessage(theme === 'light' ? 'Light' : 'Dark', currentLanguage)}
                </option>
              ))}
            </select>
          </label>

          {renderTopbarActions()}
        </div>
      </nav>

      <main className="main-shell">
        <header className="topbar">
          <div>
            <h1>{pageMeta.title}</h1>
          </div>
          {selectedAccount ? (
            <div className="topnav-status" style={{ gap: '4px' }}>
              {selectedAccount.isCodexActive ? (
                <span className="badge tone-primary">Codex</span>
              ) : null}
              <span className={`badge tone-${statusTone(selectedAccount.status)}`}>
                {selectedAccount.status}
              </span>
              <span className="badge soft">{displayAccountName(selectedAccount)}</span>
            </div>
          ) : null}
        </header>

        {notice ? (
          <section className="notice-banner">
            <CircleAlert className="icon-sm" />
            <span>{notice}</span>
          </section>
        ) : null}

        {updateStatus.status !== 'idle' && updateStatus.status !== 'not-available' ? (
          <section className="notice-banner guard-banner">
            <CircleAlert className="icon-sm" />
            <div className="guard-copy">
              <strong>
                {updateStatus.nextVersion
                  ? `Cap nhat ${updateStatus.nextVersion}`
                  : 'Cap nhat app'}
              </strong>
              <span>{updateStatus.message || formatUpdateStatusLabel(updateStatus)}</span>
              {updateStatus.releaseNotes ? (
                <small>{updateStatus.releaseNotes}</small>
              ) : null}
            </div>
            <div className="header-inline-actions">
              {updateStatus.status === 'downloaded' ? (
                <button
                  className="button primary small"
                  type="button"
                  onClick={() => void handleInstallUpdate()}
                >
                  Cai dat va khoi dong lai
                </button>
              ) : null}
              {updateStatus.status === 'error' ? (
                <button
                  className="button ghost small"
                  type="button"
                  onClick={() => void handleCheckForUpdates()}
                >
                  Thu lai
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="content-shell">{renderCurrentView()}</section>
      </main>
    </div>
  )
}

export default App
