import { appLanguages, type AppLanguage } from './types'

type TranslationEntry = Partial<Record<AppLanguage, string>>
type DynamicRule = {
  pattern: RegExp
  translate: (match: RegExpMatchArray) => TranslationEntry
}

type TranslatableAttribute = 'placeholder' | 'title' | 'aria-label'

const attributeSources = new WeakMap<
  Element,
  Partial<Record<TranslatableAttribute, string>>
>()
const textSources = new WeakMap<Text, string>()

const localeByLanguage: Record<AppLanguage, string> = {
  vi: 'vi-VN',
  en: 'en-US',
  ja: 'ja-JP',
  'zh-CN': 'zh-CN',
  hi: 'hi-IN',
  ko: 'ko-KR',
}

let activeLanguage: AppLanguage = 'vi'

function entry(
  en: string,
  ja: string,
  zhCN: string,
  hi: string,
  ko: string,
): TranslationEntry {
  return {
    en,
    ja,
    'zh-CN': zhCN,
    hi,
    ko,
  }
}

const exactTranslations: Record<string, TranslationEntry> = {
  Dashboard: entry('Dashboard', 'ダッシュボード', '仪表板', 'डैशबोर्ड', '대시보드'),
  Accounts: entry('Accounts', 'アカウント', '账号', 'अकाउंट', '계정'),
  Workspace: entry('Workspace', 'ワークスペース', '工作区', 'वर्कस्पेस', '워크스페이스'),
  Backups: entry('Backups', 'バックアップ', '备份', 'बैकअप', '백업'),
  Settings: entry('Settings', '設定', '设置', 'सेटिंग्स', '설정'),
  'Tong quan va de xuat': entry(
    'Overview and suggestions',
    '概要と提案',
    '概览与建议',
    'सारांश और सुझाव',
    '개요 및 추천',
  ),
  'Grid/list va thao tac nhanh': entry(
    'Grid/list and quick actions',
    'グリッド/リストとクイック操作',
    '网格/列表与快捷操作',
    'ग्रिड/सूची और त्वरित क्रियाएं',
    '그리드/리스트와 빠른 작업',
  ),
  'Chinh sua profile dang focus': entry(
    'Edit the focused profile',
    '現在のプロフィールを編集',
    '编辑当前聚焦的配置',
    'फोकस प्रोफ़ाइल संपादित करें',
    '현재 선택된 프로필 편집',
  ),
  'Luu kho chat export theo slot': entry(
    'Store exported chats per slot',
    'スロットごとにエクスポートしたチャットを保存',
    '按槽位保存导出的聊天记录',
    'हर स्लॉट के लिए चैट एक्सपोर्ट संग्रहित करें',
    '슬롯별로 내보낸 채팅 저장',
  ),
  'Du lieu local va huong dan': entry(
    'Local data and guidance',
    'ローカルデータとガイド',
    '本地数据与说明',
    'लोकल डेटा और निर्देश',
    '로컬 데이터 및 안내',
  ),
  'Control Center': entry('Control Center', 'コントロールセンター', '控制中心', 'कंट्रोल सेंटर', '컨트롤 센터'),
  'Tong quan slot, session va de xuat account nen dung tiep theo.': entry(
    'Overview of slots, sessions, and the next recommended account.',
    'スロット、セッション、次に使うべきアカウントの概要です。',
    '查看槽位、会话以及下一步推荐使用的账号。',
    'स्लॉट, सत्र और अगले सुझाए गए अकाउंट का सारांश।',
    '슬롯, 세션, 다음 추천 계정의 개요입니다.',
  ),
  'Account Center': entry('Account Center', 'アカウントセンター', '账号中心', 'अकाउंट सेंटर', '계정 센터'),
  'Grid/list thao tac nhanh, filter va chon account dang focus.': entry(
    'Quick grid/list actions, filters, and focused account selection.',
    'グリッド/リストの操作、フィルタ、対象アカウントの選択。',
    '快速网格/列表操作、筛选和聚焦账号选择。',
    'त्वरित ग्रिड/सूची क्रियाएं, फ़िल्टर और फोकस अकाउंट चयन।',
    '빠른 그리드/리스트 작업, 필터, 포커스 계정 선택.',
  ),
  'Chinh sua chi tiet account, session URL, repo va ghi chu van hanh.': entry(
    'Edit account details, session URL, repos, and operating notes.',
    'アカウント詳細、セッションURL、リポジトリ、運用メモを編集します。',
    '编辑账号详情、会话 URL、仓库和操作备注。',
    'अकाउंट विवरण, सत्र URL, रिपॉजिटरी और ऑपरेशन नोट्स संपादित करें।',
    '계정 정보, 세션 URL, 리포지토리, 운영 메모를 수정합니다.',
  ),
  'Backup Center': entry('Backup Center', 'バックアップセンター', '备份中心', 'बैकअप सेंटर', '백업 센터'),
  'Nhap export ChatGPT, luu kho local va tra cuu conversation theo slot.': entry(
    'Import ChatGPT exports, store them locally, and browse conversations by slot.',
    'ChatGPTエクスポートを取り込み、ローカル保存し、スロットごとに会話を参照します。',
    '导入 ChatGPT 导出文件，存到本地，并按槽位查看会话。',
    'ChatGPT एक्सपोर्ट आयात करें, लोकल में रखें और स्लॉट अनुसार वार्तालाप देखें।',
    'ChatGPT 내보내기를 가져와 로컬에 저장하고 슬롯별 대화를 조회합니다.',
  ),
  'Local Settings': entry('Local Settings', 'ローカル設定', '本地设置', 'लोकल सेटिंग्स', '로컬 설정'),
  'Vi tri du lieu local, import/export va quy trinh su dung session.': entry(
    'Local data location, import/export, and session workflow.',
    'ローカルデータの場所、インポート/エクスポート、セッション運用フロー。',
    '本地数据位置、导入/导出与会话流程。',
    'लोकल डेटा स्थान, आयात/निर्यात और सत्र प्रक्रिया।',
    '로컬 데이터 위치, 가져오기/내보내기 및 세션 흐름.',
  ),
  Storage: entry('Storage', 'ストレージ', '存储', 'स्टोरेज', '저장소'),
  'Du lieu local': entry('Local data', 'ローカルデータ', '本地数据', 'लोकल डेटा', '로컬 데이터'),
  'Save status': entry('Save status', '保存状態', '保存状态', 'सेव स्थिति', '저장 상태'),
  'Data file': entry('Data file', 'データファイル', '数据文件', 'डेटा फ़ाइल', '데이터 파일'),
  'App version': entry('App version', 'アプリバージョン', '应用版本', 'ऐप संस्करण', '앱 버전'),
  Update: entry('Update', 'アップデート', '更新', 'अपडेट', '업데이트'),
  'Background mode': entry('Background mode', 'バックグラウンドモード', '后台模式', 'बैकग्राउंड मोड', '백그라운드 모드'),
  Language: entry('Language', '言語', '语言', 'भाषा', '언어'),
  Theme: entry('Theme', 'テーマ', '主题', 'थीम', '테마'),
  Light: entry('Light', 'ライト', '浅色', 'लाइट', '라이트'),
  Dark: entry('Dark', 'ダーク', '深色', 'डार्क', '다크'),
  Flow: entry('Flow', 'フロー', '流程', 'फ़्लो', '플로우'),
  'Cach dung giong Antigravity': entry(
    'Antigravity-style workflow',
    'Antigravity風の使い方',
    '类似 Antigravity 的使用流程',
    'Antigravity जैसी कार्यप्रणाली',
    'Antigravity 스타일 워크플로우',
  ),
  'Dong cua so chinh de an xuong tray/menu bar': entry(
    'Close the main window to hide it to the tray/menu bar',
    'メインウィンドウを閉じるとトレイ/メニューバーに隠れます',
    '关闭主窗口后会隐藏到托盘/菜单栏',
    'मुख्य विंडो बंद करने पर यह ट्रे/मेनू बार में छिप जाएगी',
    '메인 창을 닫으면 트레이/메뉴 막대로 숨겨집니다',
  ),
  'Dong cua so chinh de app tiep tuc chay nen; muon tat han thi mo tray/menu bar va chon Thoat.': entry(
    'Close the main window to keep the app running in the background; open the tray/menu bar and choose Quit to exit fully.',
    'メインウィンドウを閉じるとアプリはバックグラウンドで動作し続けます。完全に終了するにはトレイ/メニューバーから終了を選んでください。',
    '关闭主窗口后应用会继续在后台运行；如需完全退出，请在托盘/菜单栏中选择退出。',
    'मुख्य विंडो बंद करने पर ऐप बैकग्राउंड में चलता रहेगा; पूरी तरह बंद करने के लिए ट्रे/मेनू बार से Quit चुनें।',
    '메인 창을 닫으면 앱이 백그라운드에서 계속 실행됩니다. 완전히 종료하려면 트레이/메뉴 막대에서 종료를 선택하세요.',
  ),
  'Status Board': entry('Status Board', 'ステータスボード', '状态看板', 'स्टेटस बोर्ड', '상태 보드'),
  'Phan bo hien tai': entry('Current distribution', '現在の分布', '当前分布', 'वर्तमान 분포', '현재 분포'),
  Active: entry('Active', 'アクティブ', '活跃', 'सक्रिय', '활성'),
  'Needs login': entry('Needs login', '再ログインが必要', '需要重新登录', 'फिर से लॉगिन आवश्यक', '다시 로그인 필요'),
  Cooling: entry('Cooling', '休止中', '冷却中', 'शांत स्थिति', '쿨링'),
  'Cooling down': entry('Cooling down', 'クールダウン中', '冷却中', 'कूलडाउन', '쿨다운'),
  Archived: entry('Archived', 'アーカイブ済み', '已归档', 'संग्रहीत', '보관됨'),
  Synced: entry('Synced', '同期済み', '已同步', 'सिंक किया गया', '동기화됨'),
  Ready: entry('Ready', '準備完了', '就绪', 'तैयार', '준비됨'),
  'Chua login': entry('Not logged in', '未ログイン', '未登录', 'लॉगिन नहीं', '로그인 안 됨'),
  'Chua co profile Codex': entry(
    'No Codex profile yet',
    'Codexプロフィール未作成',
    '还没有 Codex 配置',
    'अभी तक Codex प्रोफ़ाइल नहीं',
    'Codex 프로필이 아직 없음',
  ),
  'Codex may': entry('Machine Codex', 'マシン Codex', '本机 Codex', 'मशीन Codex', '머신 Codex'),
  Session: entry('Session', 'セッション', '会话', 'सत्र', '세션'),
  Repos: entry('Repos', 'リポジトリ', '仓库', 'रिपॉज़िटरी', '리포지토리'),
  'Gia han': entry('Renewal', '更新日', '续费', 'नवीनीकरण', '갱신'),
  Surface: entry('Surface', 'サーフェス', '使用面', 'सरफेस', '서피스'),
  'Antigravity-inspired flow': entry(
    'Antigravity-inspired flow',
    'Antigravity に着想を得たフロー',
    '受 Antigravity 启发的流程',
    'Antigravity-प्रेरित फ्लो',
    'Antigravity 스타일 플로우',
  ),
  'Quan ly account nhu mot local control center, khong phai mot form don le.': entry(
    'Manage accounts like a local control center, not a one-off form.',
    '単発フォームではなく、ローカルのコントロールセンターとしてアカウントを管理します。',
    '像本地控制中心一样管理账号，而不是零散表单。',
    'अकाउंट को एक बार के फ़ॉर्म की तरह नहीं, बल्कि लोकल कंट्रोल सेंटर की तरह प्रबंधित करें।',
    '계정을 일회성 폼이 아니라 로컬 컨트롤 센터처럼 관리하세요.',
  ),
  'Dashboard nay uu tien slot nen dung, session nao da san sang, account nao sap het han va thao tac nao can lam tiep theo. Moi account mo trong cua so Electron rieng de luu session local.': entry(
    'This dashboard prioritizes which slot to use, which sessions are ready, which accounts renew soon, and what to do next. Each account opens in its own Electron window to keep its local session.',
    'このダッシュボードでは、使うべきスロット、準備できたセッション、更新が近いアカウント、次の作業を優先して表示します。各アカウントはローカルセッション保持のため個別の Electron ウィンドウで開きます。',
    '这个仪表板会优先显示该使用哪个槽位、哪些会话已就绪、哪些账号快到期，以及接下来该做什么。每个账号都在独立的 Electron 窗口中打开以保存本地会话。',
    'यह डैशबोर्ड बताता है कि कौन सा स्लॉट उपयोग करना है, कौन से सत्र तैयार हैं, कौन से अकाउंट जल्द नवीनीकृत होंगे और अगला कदम क्या है। हर अकाउंट अपना लोकल सत्र रखने के लिए अलग Electron विंडो में खुलता है।',
    '이 대시보드는 어떤 슬롯을 써야 하는지, 어떤 세션이 준비됐는지, 어떤 계정이 곧 갱신되는지, 다음 작업이 무엇인지 우선순위로 보여줍니다. 각 계정은 로컬 세션 유지를 위해 별도의 Electron 창에서 열립니다.',
  ),
  'Tao slot moi': entry('Create new slot', '新しいスロットを作成', '新建槽位', 'नया स्लॉट बनाएं', '새 슬롯 만들기'),
  'Mo Account Center': entry('Open Account Center', 'アカウントセンターを開く', '打开账号中心', 'अकाउंट सेंटर खोलें', '계정 센터 열기'),
  'Tong accounts': entry('Total accounts', 'アカウント総数', '账号总数', 'कुल अकाउंट', '전체 계정'),
  'Session ready': entry('Ready sessions', '準備済みセッション', '已就绪会话', 'तैयार सत्र', '준비된 세션'),
  'Da co session luu local': entry(
    'Sessions already stored locally',
    'ローカルに保存済みのセッション',
    '已保存在本地的会话',
    'लोकल में सहेजे गए सत्र',
    '로컬에 저장된 세션',
  ),
  'Repo gan kem': entry('Attached repos', '紐付けリポジトリ', '关联仓库', 'संलग्न रिपॉजिटरी', '연결된 리포지토리'),
  'Gia han sap toi': entry('Upcoming renewals', '近い更新', '即将续费', 'आसन्न नवीनीकरण', '다가오는 갱신'),
  Spotlight: entry('Spotlight', 'スポットライト', '聚焦', 'स्पॉटलाइट', '스포트라이트'),
  'Account dang nen focus': entry(
    'Account to focus on',
    '今注目すべきアカウント',
    '当前值得聚焦的账号',
    'अभी फोकस करने वाला अकाउंट',
    '지금 집중할 계정',
  ),
  'Mo workspace': entry('Open workspace', 'ワークスペースを開く', '打开工作区', 'वर्कस्पेस खोलें', '워크스페이스 열기'),
  'Profile Codex dang mo': entry(
    'Codex profile is open',
    'Codexプロフィールを開いています',
    'Codex 配置已打开',
    'Codex प्रोफ़ाइल खुली है',
    'Codex 프로필이 열려 있음',
  ),
  'Dang nhap / Mo session': entry(
    'Login / Open session',
    'ログイン / セッションを開く',
    '登录 / 打开会话',
    'लॉगिन / सत्र खोलें',
    '로그인 / 세션 열기',
  ),
  'Sync tai khoan': entry('Sync account', 'アカウントを同期', '同步账号', 'अकाउंट सिंक करें', '계정 동기화'),
  'Dang xu ly...': entry('Working...', '処理中...', '处理中...', 'प्रोसेस हो रहा है...', '처리 중...'),
  'Kiem tra profile': entry('Check profile', 'プロフィール確認', '检查配置', 'प्रोफ़ाइल जांचें', '프로필 확인'),
  'Dang chuyen...': entry('Switching...', '切り替え中...', '切换中...', 'स्विच हो रहा है...', '전환 중...'),
  'Mo profile Codex': entry('Open Codex profile', 'Codexプロフィールを開く', '打开 Codex 配置', 'Codex प्रोफ़ाइल खोलें', 'Codex 프로필 열기'),
  'Dang mo profile Codex...': entry(
    'Opening Codex profile...',
    'Codexプロフィールを開いています...',
    '正在打开 Codex 配置...',
    'Codex प्रोफ़ाइल खुल रही है...',
    'Codex 프로필 여는 중...',
  ),
  'Edit profile': entry('Edit profile', 'プロフィール編集', '编辑配置', 'प्रोफ़ाइल संपादित करें', '프로필 편집'),
  'Chua co account nao': entry('No accounts yet', 'まだアカウントがありません', '还没有账号', 'अभी कोई अकाउंट नहीं', '아직 계정이 없습니다'),
  'Tao account dau tien de bat dau luu session va repo.': entry(
    'Create your first account to start storing sessions and repos.',
    '最初のアカウントを作成して、セッションとリポジトリの保存を始めましょう。',
    '创建第一个账号以开始保存会话和仓库。',
    'सत्र और रिपॉजिटरी सहेजने के लिए पहला अकाउंट बनाएं।',
    '세션과 리포지토리를 저장하려면 첫 계정을 만드세요.',
  ),
  'Quick Actions': entry('Quick Actions', 'クイック操作', '快捷操作', 'त्वरित क्रियाएं', '빠른 작업'),
  'Dieu phoi local': entry('Local operations', 'ローカル運用', '本地操作', 'लोकल संचालन', '로컬 운영'),
  'Nap backup JSON': entry('Load JSON backup', 'JSONバックアップを読み込む', '加载 JSON 备份', 'JSON बैकअप लोड करें', 'JSON 백업 불러오기'),
  'Import danh sach account va repo da co': entry(
    'Import existing accounts and repos',
    '既存のアカウントとリポジトリをインポート',
    '导入已有账号和仓库',
    'मौजूदा अकाउंट और रिपॉजिटरी आयात करें',
    '기존 계정과 리포지토리 가져오기',
  ),
  'Xuat backup JSON': entry('Export JSON backup', 'JSONバックアップを書き出す', '导出 JSON 备份', 'JSON बैकअप निर्यात करें', 'JSON 백업 내보내기'),
  'Luu state local hien tai ra file ngoai': entry(
    'Save the current local state to an external file',
    '現在のローカル状態を外部ファイルに保存',
    '将当前本地状态保存到外部文件',
    'वर्तमान लोकल स्टेट को बाहरी फ़ाइल में सहेजें',
    '현재 로컬 상태를 외부 파일로 저장',
  ),
  'Mo thu muc du lieu': entry('Open data folder', 'データフォルダを開く', '打开数据文件夹', 'डेटा फ़ोल्डर खोलें', '데이터 폴더 열기'),
  'Truy cap nhanh file local trong userData': entry(
    'Quick access to local files in userData',
    'userData 内のローカルファイルへすばやくアクセス',
    '快速访问 userData 中的本地文件',
    'userData के लोकल फ़ाइलों तक त्वरित पहुंच',
    'userData 안의 로컬 파일에 빠르게 접근',
  ),
  'Mo workspace dang focus': entry('Open focused workspace', 'フォーカス中のワークスペースを開く', '打开当前工作区', 'फोकस्ड वर्कस्पेस खोलें', '현재 워크스페이스 열기'),
  'Chua chon account': entry('No account selected', 'アカウント未選択', '尚未选择账号', 'कोई अकाउंट चयनित नहीं', '선택된 계정 없음'),
  'Dang khoi tao file local...': entry(
    'Initializing local file...',
    'ローカルファイルを初期化中...',
    '正在初始化本地文件...',
    'लोकल फ़ाइल आरंभ हो रही है...',
    '로컬 파일 초기화 중...',
  ),
  'Best Accounts': entry('Best Accounts', 'おすすめアカウント', '推荐账号', 'सर्वश्रेष्ठ अकाउंट', '추천 계정'),
  'De xuat de mo tiep theo': entry(
    'Suggested next accounts',
    '次に開く候補',
    '推荐下一步打开的账号',
    'अगले उपयोग के लिए सुझाए गए अकाउंट',
    '다음에 열 추천 계정',
  ),
  'Xem tat ca': entry('View all', 'すべて表示', '查看全部', 'सभी देखें', '전체 보기'),
  'Chua co account nao de xep hang.': entry(
    'No accounts available for ranking.',
    'ランキング対象のアカウントがありません。',
    '没有可排序的账号。',
    'रैंक करने के लिए कोई अकाउंट नहीं है।',
    '순위를 매길 계정이 없습니다.',
  ),
  Renewals: entry('Renewals', '更新', '续费', 'नवीनीकरण', '갱신'),
  'Canh bao subscription': entry(
    'Subscription alerts',
    'サブスクリプション警告',
    '订阅提醒',
    'सब्सक्रिप्शन अलर्ट',
    '구독 알림',
  ),
  'Chua dat renewal date cho account nao.': entry(
    'No renewal date set for any account.',
    'どのアカウントにも更新日が設定されていません。',
    '没有任何账号设置续费日期。',
    'किसी भी अकाउंट के लिए नवीनीकरण तिथि सेट नहीं है।',
    '어떤 계정에도 갱신일이 설정되지 않았습니다.',
  ),
  'email, repo, profile, tag...': entry(
    'email, repo, profile, tag...',
    'メール、リポジトリ、プロフィール、タグ...',
    '邮箱、仓库、配置、标签...',
    'ईमेल, रिपॉजिटरी, प्रोफ़ाइल, टैग...',
    '이메일, 리포지토리, 프로필, 태그...',
  ),
  'Tat ca': entry('All', 'すべて', '全部', 'सभी', '전체'),
  Plan: entry('Plan', 'プラン', '套餐', 'प्लान', '플랜'),
  Status: entry('Status', '状態', '状态', 'स्थिति', '상태'),
  Platform: entry('Platform', 'プラットフォーム', '平台', 'प्लेटफ़ॉर्म', '플랫폼'),
  'Grid view': entry('Grid view', 'グリッド表示', '网格视图', 'ग्रिड दृश्य', '그리드 보기'),
  'List view': entry('List view', 'リスト表示', '列表视图', 'सूची दृश्य', '리스트 보기'),
  'Chon mot account de mo session, dua vao workspace hoac reset cookie rieng.': entry(
    'Select an account to open its session, jump into the workspace, or reset isolated cookies.',
    'アカウントを選択してセッションを開く、ワークスペースへ移動する、または分離された Cookie をリセットします。',
    '选择一个账号以打开会话、进入工作区或重置独立 Cookie。',
    'सत्र खोलने, वर्कस्पेस में जाने या अलग कुकी रीसेट करने के लिए अकाउंट चुनें।',
    '계정을 선택해 세션을 열거나 워크스페이스로 이동하거나 분리된 쿠키를 재설정하세요.',
  ),
  Import: entry('Import', 'インポート', '导入', 'आयात', '가져오기'),
  Export: entry('Export', 'エクスポート', '导出', 'निर्यात', '내보내기'),
  'Tao moi': entry('Create', '作成', '新建', 'बनाएं', '생성'),
  'Add Account': entry('Add Account', 'アカウント追加', '添加账号', 'अकाउंट जोड़ें', '계정 추가'),
  'Khong co account nao khop bo loc hien tai.': entry(
    'No accounts match the current filters.',
    '現在のフィルタに一致するアカウントはありません。',
    '没有账号匹配当前筛选条件。',
    'वर्तमान फ़िल्टर से मेल खाने वाला कोई अकाउंट नहीं है।',
    '현재 필터와 일치하는 계정이 없습니다.',
  ),
  'Thu bo bot filter hoac tao account moi.': entry(
    'Try removing some filters or create a new account.',
    'フィルタを減らすか、新しいアカウントを作成してください。',
    '尝试减少筛选条件或创建新账号。',
    'कुछ फ़िल्टर हटाएँ या नया अकाउंट बनाएं।',
    '필터를 줄이거나 새 계정을 만드세요.',
  ),
  Account: entry('Account', 'アカウント', '账号', 'अकाउंट', '계정'),
  Renewal: entry('Renewal', '更新', '续费', 'नवीनीकरण', '갱신'),
  Actions: entry('Actions', '操作', '操作', 'क्रियाएं', '작업'),
  Sync: entry('Sync', '同期', '同步', 'सिंक', '동기화'),
  'Focus Account': entry('Focus Account', '注目アカウント', '聚焦账号', 'फोकस अकाउंट', '포커스 계정'),
  Priority: entry('Priority', '優先度', '优先级', 'प्राथमिकता', '우선순위'),
  Partition: entry('Partition', 'パーティション', '分区', 'पार्टिशन', '파티션'),
  'Last session': entry('Last session', '前回のセッション', '上次会话', 'पिछला सत्र', '마지막 세션'),
  'Last sync': entry('Last sync', '前回の同期', '上次同步', 'पिछला सिंक', '마지막 동기화'),
  'Codex profile': entry('Codex profile', 'Codexプロフィール', 'Codex 配置', 'Codex प्रोफ़ाइल', 'Codex 프로필'),
  usage: entry('usage', '使用量', '用量', 'उपयोग', '사용량'),
  'Reset usage': entry('Reset usage', 'リセット時刻', '重置用量', 'रीसेट उपयोग', '사용량 리셋'),
  Credits: entry('Credits', 'クレジット', '额度', 'क्रेडिट', '크레딧'),
  'Profile account': entry('Profile account', 'プロフィールのアカウント', '配置账号', 'प्रोफ़ाइल अकाउंट', '프로필 계정'),
  'Profile path': entry('Profile path', 'プロフィールパス', '配置路径', 'प्रोफ़ाइल पथ', '프로필 경로'),
  'Codex workspace': entry('Codex workspace', 'Codex ワークスペース', 'Codex 工作区', 'Codex वर्कस्पेस', 'Codex 워크스페이스'),
  'Dang sync...': entry('Syncing...', '同期中...', '同步中...', 'सिंक हो रहा है...', '동기화 중...'),
  'Dang doc usage...': entry('Reading usage...', '使用量を読込中...', '正在读取用量...', 'उपयोग पढ़ा जा रहा है...', '사용량 읽는 중...'),
  'Sync usage Codex': entry('Sync Codex usage', 'Codex 使用量を同期', '同步 Codex 用量', 'Codex उपयोग सिंक करें', 'Codex 사용량 동기화'),
  'Dang doc gia han...': entry('Reading renewal...', '更新日を読込中...', '正在读取续费日期...', 'नवीनीकरण पढ़ा जा रहा है...', '갱신일 읽는 중...'),
  'Sync gia han': entry('Sync renewal', '更新日を同期', '同步续费日期', 'नवीनीकरण सिंक करें', '갱신 동기화'),
  Billing: entry('Billing', '請求', '计费', 'बिलिंग', '결제'),
  'Mo session': entry('Open session', 'セッションを開く', '打开会话', 'सत्र खोलें', '세션 열기'),
  'Profile dang mo': entry('Profile is open', 'プロフィールを開いています', '配置已打开', 'प्रोफ़ाइल खुली है', '프로필이 열려 있음'),
  'Open profile folder': entry('Open profile folder', 'プロフィールフォルダを開く', '打开配置文件夹', 'प्रोफ़ाइल फ़ोल्डर खोलें', '프로필 폴더 열기'),
  Reset: entry('Reset', 'リセット', '重置', 'रीसेट', '재설정'),
  'Copy partition': entry('Copy partition', 'パーティションをコピー', '复制分区', 'पार्टिशन कॉपी करें', '파티션 복사'),
  Diagnostics: entry('Diagnostics', '診断', '诊断', 'निदान', '진단'),
  'Quick Notes': entry('Quick Notes', 'クイックメモ', '快速备注', 'त्वरित नोट्स', '빠른 메모'),
  'Huong dan su dung': entry('Usage guide', '使い方', '使用指南', 'उपयोग गाइड', '사용 가이드'),
  'Mo session rieng cho account.': entry(
    'Open the isolated session for the account.',
    'このアカウント専用のセッションを開きます。',
    '打开该账号的独立会话。',
    'अकाउंट के लिए अलग सत्र खोलें।',
    '계정의 분리된 세션을 엽니다.',
  ),
  'Dang nhap ChatGPT/Codex trong cua so do.': entry(
    'Log into ChatGPT/Codex in that window.',
    'そのウィンドウで ChatGPT/Codex にログインします。',
    '在该窗口中登录 ChatGPT/Codex。',
    'उस विंडो में ChatGPT/Codex में लॉगिन करें।',
    '그 창에서 ChatGPT/Codex에 로그인하세요.',
  ),
  'Bam Sync de doc email, ten va goi tu session vua luu.': entry(
    'Press Sync to read email, name, and plan from the stored session.',
    'Sync を押すと保存済みセッションからメール、名前、プランを読み取ります。',
    '点击 Sync 从已保存会话中读取邮箱、名称和套餐。',
    'सहेजे गए सत्र से ईमेल, नाम और प्लान पढ़ने के लिए Sync दबाएं।',
    'Sync를 눌러 저장된 세션에서 이메일, 이름, 플랜을 읽습니다.',
  ),
  'Bam Mo profile Codex de mo Codex local theo profile rieng cua slot da chon.': entry(
    'Use Open Codex profile to launch local Codex with the selected slot profile.',
    'Open Codex profile を押すと選択したスロットのプロフィールでローカル Codex を開きます。',
    '点击打开 Codex 配置即可用所选槽位的配置启动本地 Codex。',
    'चयनित स्लॉट प्रोफ़ाइल के साथ लोकल Codex खोलने के लिए Open Codex profile दबाएं।',
    '선택한 슬롯 프로필로 로컬 Codex를 열려면 Open Codex profile을 누르세요.',
  ),
  'Neu slot chua co profile, dang nhap trong Codex vua mo roi bam Kiem tra profile de xac nhan cho lan doi sau.': entry(
    'If the slot has no profile yet, log into the opened Codex and press Check profile to confirm it for the next switch.',
    'まだプロフィールがない場合は、開いた Codex でログインし、Check profile を押して次回切り替え用に確定してください。',
    '如果该槽位还没有配置，请在已打开的 Codex 中登录，然后点击检查配置，以便下次切换时复用。',
    'यदि स्लॉट में अभी प्रोफ़ाइल नहीं है, तो खुले हुए Codex में लॉगिन करें और अगली बार के लिए पुष्टि हेतु Check profile दबाएं।',
    '슬롯에 아직 프로필이 없다면 열린 Codex에서 로그인한 뒤 Check profile을 눌러 다음 전환에 대비해 확인하세요.',
  ),
  'Chua co account dang focus.': entry('No focused account.', 'フォーカス中のアカウントがありません。', '没有当前聚焦的账号。', 'कोई फोकस अकाउंट नहीं है।', '포커스된 계정이 없습니다.'),
  'Chon mot account tu Dashboard hoac Account Center.': entry(
    'Select an account from Dashboard or Account Center.',
    'Dashboard または Account Center からアカウントを選択してください。',
    '请从 Dashboard 或 Account Center 选择一个账号。',
    'Dashboard या Account Center से अकाउंट चुनें।',
    'Dashboard 또는 Account Center에서 계정을 선택하세요.',
  ),
  'Profile Codex dang active khong trung voi slot dang focus.': entry(
    'The active Codex profile does not match the focused slot.',
    'アクティブな Codex プロフィールが現在のスロットと一致しません。',
    '当前活动的 Codex 配置与聚焦槽位不一致。',
    'सक्रिय Codex प्रोफ़ाइल फोकस स्लॉट से मेल नहीं खाती।',
    '현재 활성 Codex 프로필이 포커스 슬롯과 일치하지 않습니다.',
  ),
  'Chuyen sang slot nay': entry('Switch to this slot', 'このスロットに切り替え', '切换到此槽位', 'इस स्लॉट पर स्विच करें', '이 슬롯으로 전환'),
  'Mo slot dang active': entry('Open active slot', 'アクティブなスロットを開く', '打开当前活动槽位', 'सक्रिय स्लॉट खोलें', '활성 슬롯 열기'),
  Profile: entry('Profile', 'プロフィール', '配置', 'प्रोफ़ाइल', '프로필'),
  'Thong tin co ban': entry('Basic information', '基本情報', '基础信息', 'मूल जानकारी', '기본 정보'),
  'Copy email': entry('Copy email', 'メールをコピー', '复制邮箱', 'ईमेल कॉपी करें', '이메일 복사'),
  Duplicate: entry('Duplicate', '複製', '复制', 'डुप्लिकेट', '복제'),
  Delete: entry('Delete', '削除', '删除', 'हटाएं', '삭제'),
  'Synced name': entry('Synced name', '同期済み名', '同步名称', 'सिंक किया गया नाम', '동기화된 이름'),
  'Synced email': entry('Synced email', '同期済みメール', '同步邮箱', 'सिंक किया गया ईमेल', '동기화된 이메일'),
  'Synced plan': entry('Synced plan', '同期済みプラン', '同步套餐', 'सिंक किया गया प्लान', '동기화된 플랜'),
  'Chua nhan dien': entry('Not detected yet', '未検出', '尚未识别', 'अभी नहीं पहचाना गया', '아직 감지되지 않음'),
  'Bam Kiem tra profile lai de cap nhat fingerprint cho slot nay.': entry(
    'Press Check profile again to update the fingerprint for this slot.',
    'このスロットの識別情報を更新するには、もう一度 Check profile を押してください。',
    '再次点击检查配置以更新该槽位的指纹。',
    'इस स्लॉट का फिंगरप्रिंट अपडेट करने के लिए Check profile फिर दबाएं।',
    '이 슬롯의 지문 정보를 업데이트하려면 Check profile을 다시 누르세요.',
  ),
  'Day la profile Codex dang active tren may nay.': entry(
    'This is the active Codex profile on this machine.',
    'これはこのマシンでアクティブな Codex プロフィールです。',
    '这是此机器上当前活动的 Codex 配置。',
    'यह इस मशीन पर सक्रिय Codex प्रोफ़ाइल है।',
    '이것이 이 기기에서 활성 상태인 Codex 프로필입니다.',
  ),
  'Ten hien thi': entry('Display name', '表示名', '显示名称', 'डिस्प्ले नाम', '표시 이름'),
  Email: entry('Email', 'メール', '邮箱', 'ईमेल', '이메일'),
  'Email tu session': entry('Email from session', 'セッションのメール', '来自会话的邮箱', 'सत्र से ईमेल', '세션 이메일'),
  'Session dang bao cao:': entry('Session reports:', 'セッション報告:', '会话报告:', 'सत्र रिपोर्ट:', '세션 보고:'),
  'Workspace mo voi profile Codex': entry(
    'Workspace opened with Codex profile',
    'Codexプロフィールで開くワークスペース',
    '用 Codex 配置打开的工作区',
    'Codex प्रोफ़ाइल के साथ खुलने वाला वर्कस्पेस',
    'Codex 프로필로 열 워크스페이스',
  ),
  'De trong thi app se dung repo dau tien co path.': entry(
    'If left empty, the app uses the first repo that has a path.',
    '空欄の場合、パスがある最初のリポジトリを使います。',
    '留空时，应用会使用第一个带路径的仓库。',
    'खाली छोड़ने पर ऐप पहले पाथ वाले रिपॉजिटरी का उपयोग करेगा।',
    '비워 두면 경로가 있는 첫 번째 리포지토리를 사용합니다.',
  ),
  'Lan dung cuoi': entry('Last used', '最終使用日', '最后使用', 'अंतिम उपयोग', '마지막 사용'),
  'Browser profile': entry('Browser profile', 'ブラウザプロフィール', '浏览器配置', 'ब्राउज़र प्रोफ़ाइल', '브라우저 프로필'),
  Open: entry('Open', '開く', '打开', 'खोलें', '열기'),
  'Budget / note limit': entry('Budget / note limit', '予算 / メモ上限', '预算 / 备注限制', 'बजट / नोट सीमा', '예산 / 메모 한도'),
  'Muc dich chinh': entry('Main purpose', '主な目的', '主要用途', 'मुख्य उद्देश्य', '주요 목적'),
  'Ghi chu': entry('Notes', 'メモ', '备注', 'नोट्स', '메모'),
  Operations: entry('Operations', '運用', '操作', 'ऑपरेशंस', '운영'),
  'Tags va ghi chu': entry('Tags and notes', 'タグとメモ', '标签与备注', 'टैग और नोट्स', '태그와 메모'),
  Tags: entry('Tags', 'タグ', '标签', 'टैग', '태그'),
  Repositories: entry('Repositories', 'リポジトリ', '仓库', 'रिपॉजिटरी', '리포지토리'),
  'Repo gan voi account': entry('Repos linked to this account', 'このアカウントに紐付くリポジトリ', '与该账号关联的仓库', 'इस अकाउंट से जुड़ी रिपॉजिटरी', '이 계정에 연결된 리포지토리'),
  'Them repo': entry('Add repo', 'リポジトリ追加', '添加仓库', 'रिपॉजिटरी जोड़ें', '리포지토리 추가'),
  'Chua co repo nao gan voi account nay.': entry(
    'No repos linked to this account yet.',
    'このアカウントに紐付くリポジトリはまだありません。',
    '该账号还没有关联仓库。',
    'इस अकाउंट से अभी कोई रिपॉजिटरी जुड़ी नहीं है।',
    '이 계정에 연결된 리포지토리가 아직 없습니다.',
  ),
  'Ten repo': entry('Repo name', 'リポジトリ名', '仓库名', 'रिपॉजिटरी नाम', '리포지토리 이름'),
  'Branch mac dinh': entry('Default branch', 'デフォルトブランチ', '默认分支', 'डिफ़ॉल्ट ब्रांच', '기본 브랜치'),
  Path: entry('Path', 'パス', '路径', 'पथ', '경로'),
  'Muc dich': entry('Purpose', '目的', '用途', 'उद्देश्य', '목적'),
  'Delete repo': entry('Delete repo', 'リポジトリ削除', '删除仓库', 'रिपॉजिटरी हटाएं', '리포지토리 삭제'),
  'Chua co slot de gan backup.': entry(
    'No slot available for backups yet.',
    'バックアップに使えるスロットがまだありません。',
    '还没有可用于备份的槽位。',
    'बैकअप के लिए अभी कोई स्लॉट नहीं है।',
    '백업에 사용할 슬롯이 아직 없습니다.',
  ),
  'Chon mot account, sau do import file export ChatGPT cho slot do.': entry(
    'Select an account, then import the ChatGPT export file for that slot.',
    'アカウントを選択してから、そのスロット用の ChatGPT エクスポートを取り込んでください。',
    '先选择一个账号，再为该槽位导入 ChatGPT 导出文件。',
    'पहले अकाउंट चुनें, फिर उस स्लॉट के लिए ChatGPT एक्सपोर्ट आयात करें।',
    '계정을 먼저 선택한 뒤 해당 슬롯의 ChatGPT 내보내기 파일을 가져오세요.',
  ),
  'Focused Slot': entry('Focused Slot', 'フォーカス中のスロット', '当前槽位', 'फोकस्ड स्लॉट', '포커스 슬롯'),
  'Kho backup local': entry('Local backup vault', 'ローカルバックアップ保管庫', '本地备份仓库', 'लोकल बैकअप स्टोर', '로컬 백업 보관함'),
  'Imported files': entry('Imported files', '取り込み済みファイル', '已导入文件', 'आयातित फ़ाइलें', '가져온 파일'),
  Conversations: entry('Conversations', '会話', '会话', 'वार्तालाप', '대화'),
  Messages: entry('Messages', 'メッセージ', '消息', 'संदेश', '메시지'),
  'Backup folder': entry('Backup folder', 'バックアップフォルダ', '备份文件夹', 'बैकअप फ़ोल्डर', '백업 폴더'),
  'Import export ChatGPT': entry('Import ChatGPT export', 'ChatGPT エクスポートを取り込む', '导入 ChatGPT 导出文件', 'ChatGPT एक्सपोर्ट आयात करें', 'ChatGPT 내보내기 가져오기'),
  'Dang import...': entry('Importing...', '取込中...', '导入中...', 'आयात हो रहा है...', '가져오는 중...'),
  'Mo thu muc backup': entry('Open backup folder', 'バックアップフォルダを開く', '打开备份文件夹', 'बैकअप फ़ोल्डर खोलें', '백업 폴더 열기'),
  'Trong ChatGPT, request Data Export cho account can sao luu.': entry(
    'In ChatGPT, request a Data Export for the account you want to back up.',
    'ChatGPT で、バックアップしたいアカウントの Data Export を申請してください。',
    '在 ChatGPT 中为要备份的账号申请数据导出。',
    'ChatGPT में बैकअप वाले अकाउंट के लिए Data Export का अनुरोध करें।',
    'ChatGPT에서 백업할 계정의 Data Export를 요청하세요.',
  ),
  'Sau khi nhan email, tai file `.zip` ve may.': entry(
    'After the email arrives, download the `.zip` file.',
    'メールが届いたら `.zip` ファイルをダウンロードしてください。',
    '收到邮件后，下载 `.zip` 文件。',
    'ईमेल मिलने के बाद `.zip` फ़ाइल डाउनलोड करें।',
    '이메일을 받으면 `.zip` 파일을 다운로드하세요.',
  ),
  'Import file `.zip` hoac `conversations.json` vao slot nay.': entry(
    'Import the `.zip` file or `conversations.json` into this slot.',
    'このスロットに `.zip` または `conversations.json` を取り込んでください。',
    '将 `.zip` 或 `conversations.json` 导入到此槽位。',
    'इस स्लॉट में `.zip` या `conversations.json` आयात करें।',
    '이 슬롯에 `.zip` 또는 `conversations.json`을 가져오세요.',
  ),
  'App se luu mot ban archive local rieng de tra cuu va sao chep.': entry(
    'The app stores a separate local archive for lookup and copying.',
    'アプリは参照やコピーのために別のローカルアーカイブを保存します。',
    '应用会单独保存一份本地归档，便于查询和复制。',
    'ऐप खोज और कॉपी के लिए अलग लोकल आर्काइव रखेगा।',
    '앱이 조회와 복사를 위해 별도의 로컬 아카이브를 저장합니다.',
  ),
  'Imported Backups': entry('Imported Backups', '取り込み済みバックアップ', '已导入备份', 'आयातित बैकअप', '가져온 백업'),
  'Danh sach file da nap': entry('Loaded files', '読み込み済みファイル', '已加载文件列表', 'लोड की गई फ़ाइलें', '불러온 파일'),
  'Chua co backup nao.': entry('No backups yet.', 'まだバックアップがありません。', '还没有备份。', 'अभी कोई बैकअप नहीं है।', '아직 백업이 없습니다.'),
  'Import file export cua OpenAI de bat dau luu kho local.': entry(
    'Import an OpenAI export file to start your local archive.',
    'OpenAI のエクスポートファイルを取り込んでローカル保管庫を開始します。',
    '导入 OpenAI 导出文件以开始本地归档。',
    'लोकल आर्काइव शुरू करने के लिए OpenAI एक्सपोर्ट फ़ाइल आयात करें।',
    'OpenAI 내보내기 파일을 가져와 로컬 보관을 시작하세요.',
  ),
  Preview: entry('Preview', 'プレビュー', '预览', 'पूर्वावलोकन', '미리보기'),
  'Chua chon chat': entry('No chat selected', 'チャット未選択', '未选择聊天', 'कोई चैट चयनित नहीं', '선택된 채팅 없음'),
  'Tim theo title, message, participant...': entry(
    'Search by title, message, participant...',
    'タイトル、メッセージ、参加者で検索...',
    '按标题、消息、参与者搜索...',
    'शीर्षक, संदेश, प्रतिभागी से खोजें...',
    '제목, 메시지, 참여자 검색...',
  ),
  'Dang nap backup.': entry('Loading backup.', 'バックアップを読み込み中。', '正在加载备份。', 'बैकअप लोड हो रहा है।', '백업 불러오는 중.'),
  'App dang doc noi dung conversation tu kho local.': entry(
    'The app is reading conversation content from local storage.',
    'アプリがローカル保管庫から会話内容を読み込んでいます。',
    '应用正在从本地存储读取会话内容。',
    'ऐप लोकल स्टोर से वार्तालाप सामग्री पढ़ रहा है।',
    '앱이 로컬 저장소에서 대화 내용을 읽는 중입니다.',
  ),
  'Khong doc duoc backup.': entry('Failed to read backup.', 'バックアップを読めませんでした。', '无法读取备份。', 'बैकअप पढ़ा नहीं जा सका।', '백업을 읽을 수 없습니다.'),
  'Thu import lai file export hoac kiem tra thu muc backup local.': entry(
    'Try importing the export again or check the local backup folder.',
    'エクスポートを再インポートするか、ローカルバックアップフォルダを確認してください。',
    '请重新导入导出文件，或检查本地备份文件夹。',
    'एक्सपोर्ट फ़ाइल फिर आयात करें या लोकल बैकअप फ़ोल्डर जांचें।',
    '내보내기 파일을 다시 가져오거나 로컬 백업 폴더를 확인하세요.',
  ),
  'Khong co ket qua phu hop.': entry('No matching results.', '一致する結果がありません。', '没有匹配结果。', 'कोई मेल खाने वाला परिणाम नहीं।', '일치하는 결과가 없습니다.'),
  'Thu doi tu khoa tim kiem hoac chon file backup khac.': entry(
    'Try a different keyword or choose another backup file.',
    '検索語を変えるか、別のバックアップファイルを選んでください。',
    '尝试更换关键词或选择其他备份文件。',
    'दूसरा कीवर्ड आज़माएँ या कोई अन्य बैकअप फ़ाइल चुनें।',
    '다른 검색어를 쓰거나 다른 백업 파일을 선택하세요.',
  ),
  'Khong co preview.': entry('No preview.', 'プレビューなし。', '没有预览。', 'कोई पूर्वावलोकन नहीं।', '미리보기 없음.'),
  'Chua co conversation duoc chon.': entry(
    'No conversation selected.',
    '会話が選択されていません。',
    '尚未选择会话。',
    'कोई वार्तालाप चयनित नहीं है।',
    '선택된 대화가 없습니다.',
  ),
  'Chon mot chat o cot ben trai de xem noi dung.': entry(
    'Choose a chat in the left column to view its content.',
    '左の列からチャットを選ぶと内容を表示します。',
    '在左侧选择一个聊天即可查看内容。',
    'सामग्री देखने के लिए बाएँ कॉलम से चैट चुनें।',
    '왼쪽 열에서 채팅을 선택해 내용을 보세요.',
  ),
  'Chua co backup nao dang duoc mo.': entry(
    'No backup is currently open.',
    '現在開いているバックアップはありません。',
    '当前没有打开任何备份。',
    'अभी कोई बैकअप खुला नहीं है।',
    '현재 열려 있는 백업이 없습니다.',
  ),
  'Import mot file export ChatGPT hoac chon backup da co trong danh sach.': entry(
    'Import a ChatGPT export file or choose an existing backup from the list.',
    'ChatGPT のエクスポートを取り込むか、一覧から既存のバックアップを選んでください。',
    '导入一个 ChatGPT 导出文件，或从列表中选择已有备份。',
    'ChatGPT एक्सपोर्ट फ़ाइल आयात करें या सूची से मौजूदा बैकअप चुनें।',
    'ChatGPT 내보내기 파일을 가져오거나 목록에서 기존 백업을 선택하세요.',
  ),
  'Dang nap du lieu': entry('Loading data', 'データ読込中', '正在加载数据', 'डेटा लोड हो रहा है', '데이터 로딩 중'),
  'Dang luu thay doi': entry('Saving changes', '変更を保存中', '正在保存更改', 'परिवर्तन सहेजे जा रहे हैं', '변경 사항 저장 중'),
  'Da dong bo local': entry('Saved locally', 'ローカル保存済み', '已保存到本地', 'लोकल में सहेजा गया', '로컬에 저장됨'),
  'Gap loi khi luu': entry('Save error', '保存エラー', '保存出错', 'सेव त्रुटि', '저장 오류'),
  'Dang san sang': entry('Ready to use', '利用可能', '可立即使用', 'उपयोग के लिए तैयार', '사용 준비 완료'),
  'Dang kiem tra update': entry(
    'Checking updates',
    'アップデート確認中',
    '正在检查更新',
    'अपडेट जाँचे जा रहे हैं',
    '업데이트 확인 중',
  ),
  'Da tim thay ban moi': entry(
    'Update found',
    '新しいバージョンを検出',
    '发现新版本',
    'नया संस्करण मिला',
    '새 버전을 찾음',
  ),
  'Da moi nhat': entry('Up to date', '最新です', '已是最新', 'पहले से नवीनतम', '최신 상태'),
  'Dang tai ban moi': entry(
    'Downloading update',
    'アップデートをダウンロード中',
    '正在下载更新',
    'अपडेट डाउनलोड हो रहा है',
    '업데이트 다운로드 중',
  ),
  'San sang cai dat': entry(
    'Ready to install',
    'インストール準備完了',
    '准备安装',
    'इंस्टॉल के लिए तैयार',
    '설치 준비 완료',
  ),
  'Loi update': entry('Update error', 'アップデートエラー', '更新错误', 'अपडेट त्रुटि', '업데이트 오류'),
  'Kiem tra update': entry(
    'Check updates',
    'アップデート確認',
    '检查更新',
    'अपडेट जांचें',
    '업데이트 확인',
  ),
  'Cap nhat app': entry(
    'App update',
    'アプリアップデート',
    '应用更新',
    'ऐप अपडेट',
    '앱 업데이트',
  ),
  'Cai dat va khoi dong lai': entry(
    'Install and restart',
    'インストールして再起動',
    '安装并重启',
    'इंस्टॉल करें और रीस्टार्ट करें',
    '설치 후 다시 시작',
  ),
  'Thu lai': entry('Retry', '再試行', '重试', 'फिर प्रयास करें', '다시 시도'),
  'Dang kiem tra ban cap nhat...': entry(
    'Checking for updates...',
    'アップデートを確認しています...',
    '正在检查更新...',
    'अपडेट की जाँच हो रही है...',
    '업데이트를 확인하는 중...',
  ),
  'Ban dang o phien ban moi nhat.': entry(
    'You are on the latest version.',
    '最新バージョンを使用中です。',
    '你当前已是最新版本。',
    'आप नवीनतम संस्करण पर हैं।',
    '최신 버전을 사용 중입니다.',
  ),
  'Khong kiem tra duoc ban cap nhat.': entry(
    'Could not check for updates.',
    'アップデートを確認できませんでした。',
    '无法检查更新。',
    'अपडेट की जाँच नहीं हो सकी।',
    '업데이트를 확인할 수 없습니다.',
  ),
  'Ban cap nhat chua duoc tai xong.': entry(
    'The update has not finished downloading yet.',
    'アップデートのダウンロードがまだ完了していません。',
    '更新尚未下载完成。',
    'अपडेट अभी पूरी डाउनलोड नहीं हुई है।',
    '업데이트 다운로드가 아직 완료되지 않았습니다.',
  ),
  'Auto-update chi hoat dong trong desktop build dong goi.': entry(
    'Auto-update is only available in packaged desktop builds.',
    '自動アップデートはパッケージ化されたデスクトップ版でのみ利用できます。',
    '自动更新仅在打包后的桌面版中可用。',
    'ऑटो-अपडेट केवल पैकेज्ड डेस्कटॉप बिल्ड में उपलब्ध है।',
    '자동 업데이트는 패키징된 데스크톱 빌드에서만 사용할 수 있습니다.',
  ),
  'Can dang nhap lai': entry('Needs re-login', '再ログインが必要', '需要重新登录', 'फिर से लॉगिन चाहिए', '재로그인 필요'),
  'Nen de nghi': entry('Recommended to rest', '休ませるのがおすすめ', '建议暂缓使用', 'आराम देना बेहतर', '잠시 쉬게 두는 것이 좋음'),
  'Da luu tru': entry('Archived', '保管済み', '已归档', 'संग्रहीत', '보관됨'),
  'Chua co lich gia han': entry('No renewal date', '更新日未設定', '没有续费日期', 'कोई नवीनीकरण तिथि नहीं', '갱신일 없음'),
  'Gia han hom nay': entry('Renews today', '本日更新', '今天续费', 'आज नवीनीकरण', '오늘 갱신'),
  'Gia han ngay mai': entry('Renews tomorrow', '明日更新', '明天续费', 'कल नवीनीकरण', '내일 갱신'),
  'Chua co': entry('Not available', '未設定', '暂无', 'उपलब्ध नहीं', '없음'),
  'Khong ro': entry('Unknown', '不明', '未知', 'अज्ञात', '알 수 없음'),
  'Chua dat': entry('Not set', '未設定', '未设置', 'सेट नहीं', '설정 안 됨'),
  'Chua xac dinh': entry('Unknown', '未確定', '未确定', 'अज्ञात', '미확인'),
  'Chua co lich su': entry('No history yet', '履歴なし', '暂无历史', 'अभी इतिहास नहीं', '기록 없음'),
  'Chua co email': entry('No email yet', 'メール未設定', '暂无邮箱', 'अभी ईमेल नहीं', '이메일 없음'),
  'Tai khoan': entry('Account', 'アカウント', '账号', 'अकाउंट', '계정'),
  'Chua co profile': entry('No profile yet', 'プロフィール未作成', '暂无配置', 'अभी प्रोफ़ाइल नहीं', '프로필 없음'),
  'Co profile, can xac nhan lai': entry(
    'Profile exists, needs reconfirmation',
    'プロフィールあり、再確認が必要',
    '已有配置，需要重新确认',
    'प्रोफ़ाइल मौजूद है, दोबारा पुष्टि चाहिए',
    '프로필은 있지만 다시 확인이 필요함',
  ),
  'Chua co session da luu': entry('No saved session yet', '保存済みセッションなし', '还没有已保存会话', 'अभी कोई सहेजा गया सत्र नहीं', '저장된 세션 없음'),
  Plus: entry('Plus', 'プラス', 'Plus', 'प्लस', '플러스'),
  Pro: entry('Pro', 'プロ', 'Pro', 'प्रो', '프로'),
  Business: entry('Business', 'ビジネス', 'Business', 'बिज़नेस', '비즈니스'),
  Enterprise: entry('Enterprise', 'エンタープライズ', '企业版', 'एंटरप्राइज़', '엔터프라이즈'),
  Other: entry('Other', 'その他', '其他', 'अन्य', '기타'),
  Primary: entry('Primary', 'プライマリ', '主力', 'प्राथमिक', '주력'),
  Burst: entry('Burst', 'バースト', '突发', 'बर्स्ट', '버스트'),
  Backup: entry('Backup', 'バックアップ', '备用', 'बैकअप', '백업'),
  macOS: entry('macOS', 'macOS', 'macOS', 'macOS', 'macOS'),
  Windows: entry('Windows', 'Windows', 'Windows', 'Windows', 'Windows'),
  Shared: entry('Shared', '共有', '共享', 'साझा', '공유'),
  CLI: entry('CLI', 'CLI', 'CLI', 'CLI', 'CLI'),
  App: entry('App', 'アプリ', '应用', 'ऐप', '앱'),
  Web: entry('Web', 'Web', '网页', 'वेब', '웹'),
  Mixed: entry('Mixed', '混合', '混合', 'मिश्रित', '혼합'),
  'Tai khoan moi': entry('New account', '新しいアカウント', '新账号', 'नया अकाउंट', '새 계정'),
  'San sang': entry('Ready', '準備完了', '就绪', 'तैयार', '준비됨'),
  Edit: entry('Edit', '編集', '编辑', 'संपादित करें', '편집'),
  Usage: entry('Usage', '使用量', '用量', 'उपयोग', '사용량'),
  'Open Session': entry('Open session', 'セッションを開く', '打开会话', 'सत्र खोलें', '세션 열기'),
  'Kiem tra': entry('Check', '確認', '检查', 'जांचें', '확인'),
  'Mo profile': entry('Open profile', 'プロフィールを開く', '打开配置', 'प्रोफ़ाइल खोलें', '프로필 열기'),
  'Session rieng': entry('Isolated session', '分離セッション', '独立会话', 'अलग सत्र', '분리 세션'),
  'Chua mo': entry('Not opened yet', 'まだ開いていません', '尚未打开', 'अभी नहीं खोला गया', '아직 열지 않음'),
  'Chua sync': entry('Not synced yet', 'まだ同期されていません', '尚未同步', 'अभी सिंक नहीं हुआ', '아직 동기화되지 않음'),
  'Chua chup': entry('Not captured yet', 'まだ取得していません', '尚未采集', 'अभी कैप्चर नहीं किया', '아직 캡처하지 않음'),
  'Chua doc': entry('Not read yet', 'まだ読み取っていません', '尚未读取', 'अभी नहीं पढ़ा गया', '아직 읽지 않음'),
  'Dang doc...': entry('Reading...', '読込中...', '读取中...', 'पढ़ा जा रहा है...', '읽는 중...'),
  'Dang mo...': entry('Opening...', '開いています...', '打开中...', 'खोला जा रहा है...', '여는 중...'),
  'Dang khoi tao...': entry('Initializing...', '初期化中...', '初始化中...', 'आरंभ हो रहा है...', '초기화 중...'),
  Score: entry('Score', 'スコア', '评分', 'स्कोर', '점수'),
  'Start URL': entry('Start URL', '開始 URL', '起始 URL', 'स्टार्ट URL', '시작 URL'),
  'Session opened': entry('Session opened', 'セッション開始', '会话已打开', 'सत्र खुला', '세션 열림'),
  'Sync usage': entry('Sync usage', '使用量を同期', '同步用量', 'उपयोग सिंक करें', '사용량 동기화'),
  'Mo thu muc': entry('Open folder', 'フォルダを開く', '打开文件夹', 'फ़ोल्डर खोलें', '폴더 열기'),
  'Co the bam Sync gia han de dien tu dong.': entry(
    'You can press Sync renewal to fill this automatically.',
    'Sync renewal を押すと自動入力できます。',
    '可点击同步续费日期自动填入。',
    'इसे अपने आप भरने के लिए Sync renewal दबा सकते हैं।',
    'Sync renewal을 누르면 자동으로 채울 수 있습니다.',
  ),
  'Bam Kiem tra profile lai de nhan dien account_id cua slot.': entry(
    'Press Check profile again to detect the slot account_id.',
    'スロットの account_id を認識するにはもう一度 Check profile を押してください。',
    '再次点击检查配置以识别此槽位的 account_id。',
    'इस स्लॉट का account_id पहचानने के लिए Check profile फिर दबाएं।',
    '이 슬롯의 account_id를 감지하려면 Check profile을 다시 누르세요.',
  ),
  'Dang chan doan...': entry(
    'Diagnosing...',
    '診断中...',
    '诊断中...',
    'निदान हो रहा है...',
    '진단 중...',
  ),
  'Tao mot account record cho tung tai khoan ChatGPT Plus.': entry(
    'Create one account record for each ChatGPT Plus account.',
    '各 ChatGPT Plus アカウントごとにアカウント記録を作成します。',
    '为每个 ChatGPT Plus 账号创建一条账号记录。',
    'हर ChatGPT Plus अकाउंट के लिए एक अकाउंट रिकॉर्ड बनाएं।',
    '각 ChatGPT Plus 계정마다 계정 레코드를 만드세요.',
  ),
  'Gan repo, profile path va launch command cho tung slot.': entry(
    'Attach repos, profile paths, and launch commands to each slot.',
    '各スロットにリポジトリ、プロフィールパス、起動コマンドを紐付けます。',
    '为每个槽位绑定仓库、配置路径和启动命令。',
    'हर स्लॉट में रिपॉजिटरी, प्रोफ़ाइल पाथ और लॉन्च कमांड जोड़ें।',
    '각 슬롯에 리포지토리, 프로필 경로, 실행 명령을 연결하세요.',
  ),
  'Trong Codex local, login tung account 1 lan trong dung profile cua slot roi bam Kiem tra profile.': entry(
    'In local Codex, log into each account once inside the correct slot profile, then press Check profile.',
    'ローカル Codex で各アカウントを正しいスロットプロフィール内で一度ログインし、その後 Check profile を押してください。',
    '在本地 Codex 中，用对应槽位的正确配置分别登录一次各账号，然后点击检查配置。',
    'लोकल Codex में सही स्लॉट प्रोफ़ाइल के भीतर हर अकाउंट को एक बार लॉगिन करें, फिर Check profile दबाएं।',
    '로컬 Codex에서 각 계정을 올바른 슬롯 프로필로 한 번 로그인한 뒤 Check profile을 누르세요.',
  ),
  'Dung Dashboard de mo lai Codex bang profile account can dung, khong can dang nhap lai.': entry(
    'Use Dashboard to reopen Codex with the account profile you need, without logging in again.',
    'Dashboard から必要なアカウントプロフィールで Codex を再度開けるため、再ログインは不要です。',
    '通过 Dashboard 用需要的账号配置重新打开 Codex，无需重复登录。',
    'ज़रूरी अकाउंट प्रोफ़ाइल के साथ Codex फिर खोलने के लिए Dashboard का उपयोग करें, दोबारा लॉगिन की ज़रूरत नहीं।',
    'Dashboard에서 필요한 계정 프로필로 Codex를 다시 열 수 있어 재로그인이 필요 없습니다.',
  ),
  'App se thu doc ngay gia han tu session ChatGPT cua slot nay va tu dong dien vao o tren.': entry(
    'The app will try to read the renewal date from this slot’s ChatGPT session and fill it in above.',
    'アプリはこのスロットの ChatGPT セッションから更新日を読み取り、上に自動入力しようとします。',
    '应用会尝试从该槽位的 ChatGPT 会话中读取续费日期，并自动填入上方。',
    'ऐप इस स्लॉट के ChatGPT सत्र से नवीनीकरण तिथि पढ़कर ऊपर भरने की कोशिश करेगा।',
    '앱이 이 슬롯의 ChatGPT 세션에서 갱신일을 읽어 위에 자동으로 채우려 시도합니다.',
  ),
  '/duong-dan/project': entry('/path/to/project', '/path/to/project', '/path/to/project', '/path/to/project', '/path/to/project'),
  'vi du: open -na "Google Chrome" --args --profile-directory="Profile 3"': entry(
    'example: open -na "Google Chrome" --args --profile-directory="Profile 3"',
    '例: open -na "Google Chrome" --args --profile-directory="Profile 3"',
    '例如: open -na "Google Chrome" --args --profile-directory="Profile 3"',
    'उदाहरण: open -na "Google Chrome" --args --profile-directory="Profile 3"',
    '예: open -na "Google Chrome" --args --profile-directory="Profile 3"',
  ),
  'Cap usage cho sprint nay': entry(
    'Usage cap for this sprint',
    'このスプリントの使用上限',
    '本次迭代的用量上限',
    'इस स्प्रिंट के लिए उपयोग सीमा',
    '이번 스프린트 사용 한도',
  ),
  'Review PR va bugfix': entry(
    'Review PRs and bugfixes',
    'PR レビューとバグ修正',
    '评审 PR 与修复缺陷',
    'PR समीक्षा और बगफिक्स',
    'PR 리뷰와 버그 수정',
  ),
  'Luu y ve OTP, quota, project gan voi account nay...': entry(
    'Notes about OTP, quota, and projects linked to this account...',
    'このアカウントに紐づく OTP、クォータ、プロジェクトのメモ...',
    '关于此账号的 OTP、额度和关联项目备注...',
    'इस अकाउंट से जुड़े OTP, कोटा और प्रोजेक्ट नोट्स...',
    '이 계정과 연결된 OTP, 쿼터, 프로젝트 메모...',
  ),
  'frontend bugfix, batch review...': entry(
    'frontend bugfix, batch review...',
    'フロントエンド修正、まとめてレビュー...',
    '前端修复、批量审查...',
    'फ्रंटएंड बगफिक्स, बैच रिव्यू...',
    '프론트엔드 버그 수정, 배치 리뷰...',
  ),
  unknown: entry('unknown', '不明', '未知', 'अज्ञात', '알 수 없음'),
  msg: entry('msg', '件', '条', 'संदेश', '개'),
  'Khong doc duoc file du lieu. App dang dung bo nho tam thoi.': entry(
    'Could not read the data file. The app is using temporary memory.',
    'データファイルを読めませんでした。アプリは一時メモリで動作しています。',
    '无法读取数据文件。应用当前使用临时内存。',
    'डेटा फ़ाइल नहीं पढ़ी जा सकी। ऐप फिलहाल अस्थायी मेमोरी का उपयोग कर रहा है।',
    '데이터 파일을 읽을 수 없어 앱이 임시 메모리로 실행 중입니다.',
  ),
  'Khong doc duoc noi dung backup da chon.': entry(
    'Could not read the selected backup content.',
    '選択したバックアップ内容を読めませんでした。',
    '无法读取所选备份内容。',
    'चयनित बैकअप की सामग्री नहीं पढ़ी जा सकी।',
    '선택한 백업 내용을 읽을 수 없습니다.',
  ),
  'Khong the ghi thay doi xuong o dia.': entry(
    'Could not write changes to disk.',
    '変更をディスクに書き込めませんでした。',
    '无法将更改写入磁盘。',
    'परिवर्तन डिस्क पर नहीं लिखे जा सके।',
    '변경 사항을 디스크에 기록할 수 없습니다.',
  ),
  'Khong mo duoc profile Codex cho slot nay.': entry(
    'Could not open the Codex profile for this slot.',
    'このスロットの Codex プロフィールを開けませんでした。',
    '无法打开此槽位的 Codex 配置。',
    'इस स्लॉट के लिए Codex प्रोफ़ाइल नहीं खोली जा सकी।',
    '이 슬롯의 Codex 프로필을 열 수 없습니다.',
  ),
  'Khong doc duoc profile Codex.': entry(
    'Could not read the Codex profile.',
    'Codex プロフィールを読めませんでした。',
    '无法读取 Codex 配置。',
    'Codex प्रोफ़ाइल नहीं पढ़ी जा सकी।',
    'Codex 프로필을 읽을 수 없습니다.',
  ),
  'Khong chan doan duoc profile Codex.': entry(
    'Could not diagnose the Codex profile.',
    'Codex プロフィールを診断できませんでした。',
    '无法诊断 Codex 配置。',
    'Codex प्रोफ़ाइल का निदान नहीं हो सका।',
    'Codex 프로필을 진단할 수 없습니다.',
  ),
  'Da tao mot ho so tai khoan moi.': entry(
    'Created a new account record.',
    '新しいアカウント記録を作成しました。',
    '已创建新的账号记录。',
    'नया अकाउंट रिकॉर्ड बनाया गया।',
    '새 계정 레코드를 만들었습니다.',
  ),
  'Da nhan ban account dang focus.': entry(
    'Duplicated the focused account.',
    'フォーカス中のアカウントを複製しました。',
    '已复制当前聚焦账号。',
    'फोकस अकाउंट की प्रति बना दी गई है।',
    '포커스된 계정을 복제했습니다.',
  ),
  'Da xuat du lieu.': entry(
    'Exported the data.',
    'データを書き出しました。',
    '已导出数据。',
    'डेटा निर्यात कर दिया गया।',
    '데이터를 내보냈습니다.',
  ),
  'Da nap du lieu JSON.': entry(
    'Loaded JSON data.',
    'JSON データを読み込みました。',
    '已加载 JSON 数据。',
    'JSON डेटा लोड किया गया।',
    'JSON 데이터를 불러왔습니다.',
  ),
  'Da mo vi tri luu du lieu local.': entry(
    'Opened the local data location.',
    'ローカルデータの保存場所を開きました。',
    '已打开本地数据位置。',
    'लोकल डेटा स्थान खोल दिया गया।',
    '로컬 데이터 위치를 열었습니다.',
  ),
  'Chua xac dinh duoc thu muc backup chat trong build hien tai.': entry(
    'Could not determine the chat backup folder in the current build.',
    '現在のビルドではチャットバックアップフォルダを特定できません。',
    '当前构建中无法确定聊天备份文件夹。',
    'वर्तमान बिल्ड में चैट बैकअप फ़ोल्डर निर्धारित नहीं किया जा सका।',
    '현재 빌드에서 채팅 백업 폴더를 확인할 수 없습니다.',
  ),
  'Chua xac dinh duoc thu muc profile Codex trong build hien tai.': entry(
    'Could not determine the Codex profile folder in the current build.',
    '現在のビルドでは Codex プロフィールフォルダを特定できません。',
    '当前构建中无法确定 Codex 配置文件夹。',
    'वर्तमान बिल्ड में Codex प्रोफ़ाइल फ़ोल्डर निर्धारित नहीं किया जा सका।',
    '현재 빌드에서 Codex 프로필 폴더를 확인할 수 없습니다.',
  ),
  'Khong mo duoc thu muc du lieu.': entry(
    'Could not open the data folder.',
    'データフォルダを開けませんでした。',
    '无法打开数据文件夹。',
    'डेटा फ़ोल्डर नहीं खोला जा सका।',
    '데이터 폴더를 열 수 없습니다.',
  ),
  'Khong mo duoc cua so session rieng.': entry(
    'Could not open the isolated session window.',
    '分離セッションのウィンドウを開けませんでした。',
    '无法打开独立会话窗口。',
    'अलग सत्र विंडो नहीं खुल सकी।',
    '분리 세션 창을 열 수 없습니다.',
  ),
  'Chua chon account nao cho Codex. Vao Workspace va bam "Mo profile Codex".': entry(
    'No account is selected for Codex. Go to Workspace and press "Open Codex profile".',
    'Codex 用のアカウントが未選択です。Workspace に移動して「Open Codex profile」を押してください。',
    '尚未为 Codex 选择账号。请进入 Workspace 并点击“打开 Codex 配置”。',
    'Codex के लिए कोई अकाउंट चयनित नहीं है। Workspace में जाएँ और "Open Codex profile" दबाएँ।',
    'Codex용 계정이 선택되지 않았습니다. Workspace로 이동해 "Open Codex profile"을 누르세요.',
  ),
  'Khong reset duoc session rieng.': entry(
    'Could not reset the isolated session.',
    '分離セッションをリセットできませんでした。',
    '无法重置独立会话。',
    'अलग सत्र रीसेट नहीं हो सका।',
    '분리 세션을 재설정할 수 없습니다.',
  ),
  'Khong dong bo duoc session hien tai.': entry(
    'Could not sync the current session.',
    '現在のセッションを同期できませんでした。',
    '无法同步当前会话。',
    'वर्तमान सत्र सिंक नहीं हो सका।',
    '현재 세션을 동기화할 수 없습니다.',
  ),
  'Khong doc duoc usage Codex tu profile nay.': entry(
    'Could not read Codex usage from this profile.',
    'このプロフィールから Codex 使用量を読めませんでした。',
    '无法从此配置读取 Codex 用量。',
    'इस प्रोफ़ाइल से Codex उपयोग नहीं पढ़ा जा सका।',
    '이 프로필에서 Codex 사용량을 읽을 수 없습니다.',
  ),
  'Da cap nhat usage Codex tu log local.': entry(
    'Updated Codex usage from the local log.',
    'ローカルログから Codex 使用量を更新しました。',
    '已从本地日志更新 Codex 用量。',
    'लोकल लॉग से Codex उपयोग अपडेट किया गया।',
    '로컬 로그에서 Codex 사용량을 업데이트했습니다.',
  ),
  Support: entry('Support', 'サポート', '支持', 'सहायता', '지원'),
  'Ung ho tac gia': entry(
    'Support the author',
    '作者を支援する',
    '支持作者',
    'लेखक का समर्थन करें',
    '작성자 후원',
  ),
  'Neu app huu ich, ban co the ung ho tac gia qua cac kenh ben duoi.': entry(
    'If the app is useful, you can support the author via the channels below.',
    'このアプリが役に立つなら、以下のチャンネルで作者を支援できます。',
    '如果此应用对你有帮助，可以通过以下渠道支持作者。',
    'अगर ऐप उपयोगी है, तो नीचे दिए गए माध्यमों से लेखक का समर्थन कर सकते हैं।',
    '앱이 유용하다면 아래 채널을 통해 작성자를 후원할 수 있습니다.',
  ),
  'Chuyen khoan ngan hang (VietQR)': entry(
    'Bank transfer (VietQR)',
    '銀行振込 (VietQR)',
    '银行转账 (VietQR)',
    'बैंक ट्रांसफर (VietQR)',
    '은행 이체 (VietQR)',
  ),
  'DO TAI - Timo Digital Bank by BVBank': entry(
    'DO TAI - Timo Digital Bank by BVBank',
    'DO TAI - Timo Digital Bank by BVBank',
    'DO TAI - Timo Digital Bank by BVBank',
    'DO TAI - Timo Digital Bank by BVBank',
    'DO TAI - Timo Digital Bank by BVBank',
  ),
  'Binance (USDT - BEP20)': entry(
    'Binance (USDT - BEP20)',
    'Binance (USDT - BEP20)',
    'Binance (USDT - BEP20)',
    'Binance (USDT - BEP20)',
    'Binance (USDT - BEP20)',
  ),
  'Cam on su ung ho cua ban!': entry(
    'Thank you for your support!',
    'ご支援ありがとうございます！',
    '感谢您的支持！',
    'आपके समर्थन के लिए धन्यवाद!',
    '지원해 주셔서 감사합니다!',
  ),
  'Usage Guide': entry('Usage Guide', '使い方ガイド', '使用指南', 'उपयोग गाइड', '사용 가이드'),
  'Mo session rieng va dang nhap thu cong mot lan.': entry(
    'Open a dedicated session and log in manually once.',
    '専用セッションを開き、手動で一度ログインしてください。',
    '打开专用会话并手动登录一次。',
    'एक अलग सत्र खोलें और मैन्युअल रूप से एक बार लॉगिन करें।',
    '전용 세션을 열고 수동으로 한 번 로그인하세요.',
  ),
  'Binance Pay': entry('Binance Pay', 'Binance Pay', 'Binance Pay', 'Binance Pay', 'Binance Pay'),
}

const vietnameseAccentedTranslations: Record<string, string> = {
  'Tong quan va de xuat': 'Tổng quan và đề xuất',
  'Grid/list va thao tac nhanh': 'Grid/list và thao tác nhanh',
  'Chinh sua profile dang focus': 'Chỉnh sửa profile đang focus',
  'Luu kho chat export theo slot': 'Lưu kho chat export theo slot',
  'Du lieu local va huong dan': 'Dữ liệu local và hướng dẫn',
  'Du lieu local': 'Dữ liệu local',
  'Tong quan slot, session va de xuat account nen dung tiep theo.':
    'Tổng quan slot, session và đề xuất account nên dùng tiếp theo.',
  'Grid/list thao tac nhanh, filter va chon account dang focus.':
    'Grid/list thao tác nhanh, filter và chọn account đang focus.',
  'Chinh sua chi tiet account, session URL, repo va ghi chu van hanh.':
    'Chỉnh sửa chi tiết account, session URL, repo và ghi chú vận hành.',
  'Nhap export ChatGPT, luu kho local va tra cuu conversation theo slot.':
    'Nhập export ChatGPT, lưu kho local và tra cứu conversation theo slot.',
  'Vi tri du lieu local, import/export va quy trinh su dung session.':
    'Vị trí dữ liệu local, import/export và quy trình sử dụng session.',
  'Cach dung giong Antigravity': 'Cách dùng giống Antigravity',
  'Dong cua so chinh de an xuong tray/menu bar': 'Đóng cửa sổ chính để ẩn xuống tray/menu bar',
  'Dong cua so chinh de app tiep tuc chay nen; muon tat han thi mo tray/menu bar va chon Thoat.':
    'Đóng cửa sổ chính để app tiếp tục chạy nền; muốn tắt hẳn thì mở tray/menu bar và chọn Thoát.',
  'Phan bo hien tai': 'Phân bổ hiện tại',
  'Chua login': 'Chưa login',
  'Chua co profile Codex': 'Chưa có profile Codex',
  'Codex may': 'Codex máy',
  'Gia han': 'Gia hạn',
  'Quan ly account nhu mot local control center, khong phai mot form don le.':
    'Quản lý account như một local control center, không phải một form đơn lẻ.',
  'Dashboard nay uu tien slot nen dung, session nao da san sang, account nao sap het han va thao tac nao can lam tiep theo. Moi account mo trong cua so Electron rieng de luu session local.':
    'Dashboard này ưu tiên slot nên dùng, session nào đã sẵn sàng, account nào sắp hết hạn và thao tác nào cần làm tiếp theo. Mỗi account mở trong cửa sổ Electron riêng để lưu session local.',
  'Tao slot moi': 'Tạo slot mới',
  'Mo Account Center': 'Mở Account Center',
  'Tong accounts': 'Tổng accounts',
  'Da co session luu local': 'Đã có session lưu local',
  'Repo gan kem': 'Repo gắn kèm',
  'Gia han sap toi': 'Gia hạn sắp tới',
  'Account dang nen focus': 'Account đang nên focus',
  'Mo workspace': 'Mở workspace',
  'Profile Codex dang mo': 'Profile Codex đang mở',
  'Dang nhap / Mo session': 'Đăng nhập / Mở session',
  'Sync tai khoan': 'Sync tài khoản',
  'Dang xu ly...': 'Đang xử lý...',
  'Kiem tra profile': 'Kiểm tra profile',
  'Dang chuyen...': 'Đang chuyển...',
  'Mo profile Codex': 'Mở profile Codex',
  'Dang mo profile Codex...': 'Đang mở profile Codex...',
  'Chua co account nao': 'Chưa có account nào',
  'Tao account dau tien de bat dau luu session va repo.': 'Tạo account đầu tiên để bắt đầu lưu session và repo.',
  'Dieu phoi local': 'Điều phối local',
  'Nap backup JSON': 'Nạp backup JSON',
  'Import danh sach account va repo da co': 'Import danh sách account và repo đã có',
  'Xuat backup JSON': 'Xuất backup JSON',
  'Luu state local hien tai ra file ngoai': 'Lưu state local hiện tại ra file ngoài',
  'Mo thu muc du lieu': 'Mở thư mục dữ liệu',
  'Truy cap nhanh file local trong userData': 'Truy cập nhanh file local trong userData',
  'Mo workspace dang focus': 'Mở workspace đang focus',
  'Chua chon account': 'Chưa chọn account',
  'Dang khoi tao file local...': 'Đang khởi tạo file local...',
  'De xuat de mo tiep theo': 'Đề xuất để mở tiếp theo',
  'Xem tat ca': 'Xem tất cả',
  'Chua co account nao de xep hang.': 'Chưa có account nào để xếp hạng.',
  'Canh bao subscription': 'Cảnh báo subscription',
  'Chua dat renewal date cho account nao.': 'Chưa đặt renewal date cho account nào.',
  'Tat ca': 'Tất cả',
  'Chon mot account de mo session, dua vao workspace hoac reset cookie rieng.':
    'Chọn một account để mở session, đưa vào workspace hoặc reset cookie riêng.',
  'Tao moi': 'Tạo mới',
  'Khong co account nao khop bo loc hien tai.': 'Không có account nào khớp bộ lọc hiện tại.',
  'Thu bo bot filter hoac tao account moi.': 'Thử bỏ bớt filter hoặc tạo account mới.',
  'Dang sync...': 'Đang sync...',
  'Dang doc usage...': 'Đang đọc usage...',
  'Dang doc gia han...': 'Đang đọc gia hạn...',
  'Sync gia han': 'Sync gia hạn',
  'Mo session': 'Mở session',
  'Profile dang mo': 'Profile đang mở',
  'Huong dan su dung': 'Hướng dẫn sử dụng',
  'Mo session rieng cho account.': 'Mở session riêng cho account.',
  'Dang nhap ChatGPT/Codex trong cua so do.': 'Đăng nhập ChatGPT/Codex trong cửa sổ đó.',
  'Bam Sync de doc email, ten va goi tu session vua luu.':
    'Bấm Sync để đọc email, tên và gói từ session vừa lưu.',
  'Bam Mo profile Codex de mo Codex local theo profile rieng cua slot da chon.':
    'Bấm Mở profile Codex để mở Codex local theo profile riêng của slot đã chọn.',
  'Neu slot chua co profile, dang nhap trong Codex vua mo roi bam Kiem tra profile de xac nhan cho lan doi sau.':
    'Nếu slot chưa có profile, đăng nhập trong Codex vừa mở rồi bấm Kiểm tra profile để xác nhận cho lần đổi sau.',
  'Chua co account dang focus.': 'Chưa có account đang focus.',
  'Chon mot account tu Dashboard hoac Account Center.': 'Chọn một account từ Dashboard hoặc Account Center.',
  'Profile Codex dang active khong trung voi slot dang focus.':
    'Profile Codex đang active không trùng với slot đang focus.',
  'Chuyen sang slot nay': 'Chuyển sang slot này',
  'Mo slot dang active': 'Mở slot đang active',
  'Thong tin co ban': 'Thông tin cơ bản',
  'Chua nhan dien': 'Chưa nhận diện',
  'Bam Kiem tra profile lai de cap nhat fingerprint cho slot nay.':
    'Bấm Kiểm tra profile lại để cập nhật fingerprint cho slot này.',
  'Day la profile Codex dang active tren may nay.': 'Đây là profile Codex đang active trên máy này.',
  'Ten hien thi': 'Tên hiển thị',
  'Email tu session': 'Email từ session',
  'Session dang bao cao:': 'Session đang báo cáo:',
  'Workspace mo voi profile Codex': 'Workspace mở với profile Codex',
  'De trong thi app se dung repo dau tien co path.': 'Để trống thì app sẽ dùng repo đầu tiên có path.',
  'Lan dung cuoi': 'Lần dùng cuối',
  'Muc dich chinh': 'Mục đích chính',
  'Ghi chu': 'Ghi chú',
  'Tags va ghi chu': 'Tags và ghi chú',
  'Repo gan voi account': 'Repo gắn với account',
  'Them repo': 'Thêm repo',
  'Chua co repo nao gan voi account nay.': 'Chưa có repo nào gắn với account này.',
  'Ten repo': 'Tên repo',
  'Branch mac dinh': 'Branch mặc định',
  'Muc dich': 'Mục đích',
  'Chua co slot de gan backup.': 'Chưa có slot để gắn backup.',
  'Chon mot account, sau do import file export ChatGPT cho slot do.':
    'Chọn một account, sau đó import file export ChatGPT cho slot đó.',
  'Kho backup local': 'Kho backup local',
  'Dang import...': 'Đang import...',
  'Mo thu muc backup': 'Mở thư mục backup',
  'Trong ChatGPT, request Data Export cho account can sao luu.':
    'Trong ChatGPT, request Data Export cho account cần sao lưu.',
  'Sau khi nhan email, tai file `.zip` ve may.': 'Sau khi nhận email, tải file `.zip` về máy.',
  'Import file `.zip` hoac `conversations.json` vao slot nay.':
    'Import file `.zip` hoặc `conversations.json` vào slot này.',
  'App se luu mot ban archive local rieng de tra cuu va sao chep.':
    'App sẽ lưu một bản archive local riêng để tra cứu và sao chép.',
  'Danh sach file da nap': 'Danh sách file đã nạp',
  'Chua co backup nao.': 'Chưa có backup nào.',
  'Import file export cua OpenAI de bat dau luu kho local.':
    'Import file export của OpenAI để bắt đầu lưu kho local.',
  'Chua chon chat': 'Chưa chọn chat',
  'Tim theo title, message, participant...': 'Tìm theo title, message, participant...',
  'Dang nap backup.': 'Đang nạp backup.',
  'App dang doc noi dung conversation tu kho local.': 'App đang đọc nội dung conversation từ kho local.',
  'Khong doc duoc backup.': 'Không đọc được backup.',
  'Thu import lai file export hoac kiem tra thu muc backup local.':
    'Thử import lại file export hoặc kiểm tra thư mục backup local.',
  'Khong co ket qua phu hop.': 'Không có kết quả phù hợp.',
  'Thu doi tu khoa tim kiem hoac chon file backup khac.':
    'Thử đổi từ khóa tìm kiếm hoặc chọn file backup khác.',
  'Khong co preview.': 'Không có preview.',
  'Chua co conversation duoc chon.': 'Chưa có conversation được chọn.',
  'Chon mot chat o cot ben trai de xem noi dung.': 'Chọn một chat ở cột bên trái để xem nội dung.',
  'Chua co backup nao dang duoc mo.': 'Chưa có backup nào đang được mở.',
  'Import mot file export ChatGPT hoac chon backup da co trong danh sach.':
    'Import một file export ChatGPT hoặc chọn backup đã có trong danh sách.',
  'Dang nap du lieu': 'Đang nạp dữ liệu',
  'Dang luu thay doi': 'Đang lưu thay đổi',
  'Da dong bo local': 'Đã đồng bộ local',
  'Gap loi khi luu': 'Gặp lỗi khi lưu',
  'Dang san sang': 'Đang sẵn sàng',
  'Dang kiem tra update': 'Đang kiểm tra update',
  'Da tim thay ban moi': 'Đã tìm thấy bản mới',
  'Da moi nhat': 'Đã mới nhất',
  'Dang tai ban moi': 'Đang tải bản mới',
  'San sang cai dat': 'Sẵn sàng cài đặt',
  'Loi update': 'Lỗi update',
  'Kiem tra update': 'Kiểm tra update',
  'Cap nhat app': 'Cập nhật app',
  'Cai dat va khoi dong lai': 'Cài đặt và khởi động lại',
  'Thu lai': 'Thử lại',
  'Dang kiem tra ban cap nhat...': 'Đang kiểm tra bản cập nhật...',
  'Ban dang o phien ban moi nhat.': 'Bạn đang ở phiên bản mới nhất.',
  'Khong kiem tra duoc ban cap nhat.': 'Không kiểm tra được bản cập nhật.',
  'Ban cap nhat chua duoc tai xong.': 'Bản cập nhật chưa được tải xong.',
  'Auto-update chi hoat dong trong desktop build dong goi.':
    'Auto-update chỉ hoạt động trong desktop build đóng gói.',
  'Can dang nhap lai': 'Cần đăng nhập lại',
  'Nen de nghi': 'Nên để nghỉ',
  'Da luu tru': 'Đã lưu trữ',
  'Chua co lich gia han': 'Chưa có lịch gia hạn',
  'Gia han hom nay': 'Gia hạn hôm nay',
  'Gia han ngay mai': 'Gia hạn ngày mai',
  'Chua co': 'Chưa có',
  'Khong ro': 'Không rõ',
  'Chua dat': 'Chưa đặt',
  'Chua xac dinh': 'Chưa xác định',
  'Chua co lich su': 'Chưa có lịch sử',
  'Chua co email': 'Chưa có email',
  'Tai khoan': 'Tài khoản',
  'Chua co profile': 'Chưa có profile',
  'Co profile, can xac nhan lai': 'Có profile, cần xác nhận lại',
  'Chua co session da luu': 'Chưa có session đã lưu',
  'Tai khoan moi': 'Tài khoản mới',
  'San sang': 'Sẵn sàng',
  'Kiem tra': 'Kiểm tra',
  'Mo profile': 'Mở profile',
  'Session rieng': 'Session riêng',
  'Chua mo': 'Chưa mở',
  'Chua sync': 'Chưa sync',
  'Chua chup': 'Chưa chụp',
  'Chua doc': 'Chưa đọc',
  'Dang doc...': 'Đang đọc...',
  'Dang mo...': 'Đang mở...',
  'Dang khoi tao...': 'Đang khởi tạo...',
  'Mo thu muc': 'Mở thư mục',
  'Co the bam Sync gia han de dien tu dong.': 'Có thể bấm Sync gia hạn để điền tự động.',
  'Bam Kiem tra profile lai de nhan dien account_id cua slot.':
    'Bấm Kiểm tra profile lại để nhận diện account_id của slot.',
  'Dang chan doan...': 'Đang chẩn đoán...',
  'Tao mot account record cho tung tai khoan ChatGPT Plus.':
    'Tạo một account record cho từng tài khoản ChatGPT Plus.',
  'Gan repo, profile path va launch command cho tung slot.':
    'Gắn repo, profile path và launch command cho từng slot.',
  'Trong Codex local, login tung account 1 lan trong dung profile cua slot roi bam Kiem tra profile.':
    'Trong Codex local, login từng account 1 lần trong đúng profile của slot rồi bấm Kiểm tra profile.',
  'Dung Dashboard de mo lai Codex bang profile account can dung, khong can dang nhap lai.':
    'Dùng Dashboard để mở lại Codex bằng profile account cần dùng, không cần đăng nhập lại.',
  'App se thu doc ngay gia han tu session ChatGPT cua slot nay va tu dong dien vao o tren.':
    'App sẽ thử đọc ngày gia hạn từ session ChatGPT của slot này và tự động điền vào ô trên.',
  'vi du: open -na "Google Chrome" --args --profile-directory="Profile 3"':
    'ví dụ: open -na "Google Chrome" --args --profile-directory="Profile 3"',
  'Cap usage cho sprint nay': 'Cập usage cho sprint này',
  'Review PR va bugfix': 'Review PR và bugfix',
  'Luu y ve OTP, quota, project gan voi account nay...': 'Lưu ý về OTP, quota, project gắn với account này...',
  'Khong doc duoc file du lieu. App dang dung bo nho tam thoi.':
    'Không đọc được file dữ liệu. App đang dùng bộ nhớ tạm thời.',
  'Khong doc duoc noi dung backup da chon.': 'Không đọc được nội dung backup đã chọn.',
  'Khong the ghi thay doi xuong o dia.': 'Không thể ghi thay đổi xuống ổ đĩa.',
  'Khong mo duoc profile Codex cho slot nay.': 'Không mở được profile Codex cho slot này.',
  'Khong doc duoc profile Codex.': 'Không đọc được profile Codex.',
  'Khong chan doan duoc profile Codex.': 'Không chẩn đoán được profile Codex.',
  'Da tao mot ho so tai khoan moi.': 'Đã tạo một hồ sơ tài khoản mới.',
  'Da nhan ban account dang focus.': 'Đã nhân bản account đang focus.',
  'Da xuat du lieu.': 'Đã xuất dữ liệu.',
  'Da nap du lieu JSON.': 'Đã nạp dữ liệu JSON.',
  'Da mo vi tri luu du lieu local.': 'Đã mở vị trí lưu dữ liệu local.',
  'Chua xac dinh duoc thu muc backup chat trong build hien tai.':
    'Chưa xác định được thư mục backup chat trong build hiện tại.',
  'Chua xac dinh duoc thu muc profile Codex trong build hien tai.':
    'Chưa xác định được thư mục profile Codex trong build hiện tại.',
  'Khong mo duoc thu muc du lieu.': 'Không mở được thư mục dữ liệu.',
  'Khong mo duoc cua so session rieng.': 'Không mở được cửa sổ session riêng.',
  'Chua chon account nao cho Codex. Vao Workspace va bam "Mo profile Codex".':
    'Chưa chọn account nào cho Codex. Vào Workspace và bấm "Mở profile Codex".',
  'Khong reset duoc session rieng.': 'Không reset được session riêng.',
  'Khong dong bo duoc session hien tai.': 'Không đồng bộ được session hiện tại.',
  'Khong doc duoc usage Codex tu profile nay.': 'Không đọc được usage Codex từ profile này.',
  'Da cap nhat usage Codex tu log local.': 'Đã cập nhật usage Codex từ log local.',
  'Ung ho tac gia': 'Ủng hộ tác giả',
  'Neu app huu ich, ban co the ung ho tac gia qua cac kenh ben duoi.':
    'Nếu app hữu ích, bạn có thể ủng hộ tác giả qua các kênh bên dưới.',
  'Chuyen khoan ngan hang (VietQR)': 'Chuyển khoản ngân hàng (VietQR)',
  'Cam on su ung ho cua ban!': 'Cảm ơn sự ủng hộ của bạn!',
  'Mo session rieng va dang nhap thu cong mot lan.': 'Mở session riêng và đăng nhập thủ công một lần.',
  'Dashboard': 'Tổng quan',
  'Accounts': 'Tài khoản',
  'Workspace': 'Workspace',
  'Backups': 'Sao lưu',
  'Settings': 'Cài đặt',
  'Control Center': 'Trung tâm điều khiển',
  'Account Center': 'Trung tâm tài khoản',
  'Backup Center': 'Trung tâm sao lưu',
  'Local Settings': 'Cài đặt local',
  'Storage': 'Lưu trữ',
  'Save status': 'Trạng thái lưu',
  'Data file': 'Tệp dữ liệu',
  'App version': 'Phiên bản app',
  'Update': 'Cập nhật',
  'Background mode': 'Chế độ chạy nền',
  'Language': 'Ngôn ngữ',
  'Theme': 'Chủ đề',
  'Light': 'Sáng',
  'Dark': 'Tối',
  'Flow': 'Flow',
  'Status Board': 'Bảng trạng thái',
  'Active': 'Đang hoạt động',
  'Needs login': 'Cần đăng nhập',
  'Cooling': 'Đang nghỉ',
  'Cooling down': 'Đang cooldown',
  'Archived': 'Đã lưu trữ',
  'Synced': 'Đã đồng bộ',
  'Ready': 'Sẵn sàng',
  'Session': 'Session',
  'Repos': 'Repo',
  'Surface': 'Bề mặt',
  'Antigravity-inspired flow': 'Flow lấy cảm hứng từ Antigravity',
  'Session ready': 'Session sẵn sàng',
  'Spotlight': 'Spotlight',
  'Edit profile': 'Chỉnh sửa profile',
  'Quick Actions': 'Thao tác nhanh',
  'Best Accounts': 'Account tốt nhất',
  'Renewals': 'Gia hạn',
  'email, repo, profile, tag...': 'email, repo, profile, tag...',
  'Plan': 'Gói',
  'Status': 'Trạng thái',
  'Platform': 'Nền tảng',
  'Grid view': 'Xem dạng lưới',
  'List view': 'Xem dạng danh sách',
  'Import': 'Nhập',
  'Export': 'Xuất',
  'Add Account': 'Thêm tài khoản',
  'Account': 'Tài khoản',
  'Renewal': 'Gia hạn',
  'Actions': 'Thao tác',
  'Sync': 'Đồng bộ',
  'Focus Account': 'Focus tài khoản',
  'Priority': 'Ưu tiên',
  'Partition': 'Phân vùng',
  'Last session': 'Session gần nhất',
  'Last sync': 'Lần sync gần nhất',
  'Codex profile': 'Profile Codex',
  'usage': 'Usage',
  'Reset usage': 'Reset usage',
  'Credits': 'Credits',
  'Profile account': 'Tài khoản profile',
  'Profile path': 'Đường dẫn profile',
  'Codex workspace': 'Workspace Codex',
  'Sync usage Codex': 'Sync usage Codex',
  'Billing': 'Thanh toán',
  'Open profile folder': 'Mở thư mục profile',
  'Reset': 'Reset',
  'Copy partition': 'Copy partition',
  'Diagnostics': 'Chẩn đoán',
  'Quick Notes': 'Ghi chú nhanh',
  'Profile': 'Profile',
  'Copy email': 'Copy email',
  'Duplicate': 'Nhân bản',
  'Delete': 'Xóa',
  'Synced name': 'Tên đã sync',
  'Synced email': 'Email đã sync',
  'Synced plan': 'Gói đã sync',
  'Email': 'Email',
  'Browser profile': 'Profile trình duyệt',
  'Open': 'Mở',
  'Budget / note limit': 'Giới hạn budget / ghi chú',
  'Operations': 'Vận hành',
  'Tags': 'Tags',
  'Repositories': 'Repositories',
  'Path': 'Đường dẫn',
  'Delete repo': 'Xóa repo',
  'Focused Slot': 'Slot đang focus',
  'Imported files': 'File đã import',
  'Conversations': 'Hội thoại',
  'Messages': 'Tin nhắn',
  'Backup folder': 'Thư mục backup',
  'Import export ChatGPT': 'Import/export ChatGPT',
  'Imported Backups': 'Backup đã import',
  'Preview': 'Xem trước',
  'Plus': 'Plus',
  'Pro': 'Pro',
  'Business': 'Business',
  'Enterprise': 'Enterprise',
  'Other': 'Khác',
  'Primary': 'Primary',
  'Burst': 'Burst',
  'Backup': 'Backup',
  'macOS': 'macOS',
  'Windows': 'Windows',
  'Shared': 'Shared',
  'CLI': 'CLI',
  'App': 'App',
  'Web': 'Web',
  'Mixed': 'Mixed',
  'Edit': 'Sửa',
  'Usage': 'Usage',
  'Open Session': 'Mở session',
  'Score': 'Điểm',
  'Start URL': 'URL bắt đầu',
  'Session opened': 'Đã mở session',
  'Sync usage': 'Sync usage',
  '/duong-dan/project': '/duong-dan/project',
  'frontend bugfix, batch review...': 'frontend bugfix, batch review...',
  'unknown': 'không rõ',
  'msg': 'tin nhắn',
  'Support': 'Hỗ trợ',
  'DO TAI - Timo Digital Bank by BVBank': 'DO TAI - Timo Digital Bank by BVBank',
  'Binance (USDT - BEP20)': 'Binance (USDT - BEP20)',
  'Usage Guide': 'Hướng dẫn sử dụng',
  'Binance Pay': 'Binance Pay',
}

type VietnameseDynamicRule = {
  pattern: RegExp
  translate: (match: RegExpMatchArray) => string
}

const vietnameseDynamicRules: VietnameseDynamicRule[] = [
  {
    pattern: /^Qua han (\d+) ngay$/,
    translate: ([, days]) => `Quá hạn ${days} ngày`,
  },
  {
    pattern: /^(\d+) ngay nua$/,
    translate: ([, days]) => `${days} ngày nữa`,
  },
  {
    pattern: /^Dong bo (.+)$/,
    translate: ([, value]) => `Đồng bộ ${value}`,
  },
  {
    pattern: /^Session gan nhat (.+)$/,
    translate: ([, value]) => `Session gần nhất ${value}`,
  },
  {
    pattern: /^Trong (\d+) ngay toi$/,
    translate: ([, days]) => `Trong ${days} ngày tới`,
  },
  {
    pattern: /^(\d+) slot dang Active$/,
    translate: ([, count]) => `${count} slot đang Active`,
  },
  {
    pattern: /^(\d+) slot o vai tro Primary$/,
    translate: ([, count]) => `${count} slot ở vai trò Primary`,
  },
  {
    pattern: /^(\d+) slot dang hien thi$/,
    translate: ([, count]) => `${count} slot đang hiển thị`,
  },
  {
    pattern: /^Account dang chon cho profile Codex: (.+)\.$/,
    translate: ([, name]) => `Account đang chọn cho profile Codex: ${name}.`,
  },
  {
    pattern: /^Xoa "(.+)" khoi dashboard nay\?$/,
    translate: ([, name]) => `Xóa "${name}" khỏi dashboard này?`,
  },
  {
    pattern:
      /^Reset session rieng cua "(.+)"\? Thao tac nay se xoa cookies va buoc dang nhap lai\.$/,
    translate: ([, name]) =>
      `Reset session riêng của "${name}"? Thao tác này sẽ xóa cookies và buộc đăng nhập lại.`,
  },
  {
    pattern: /^Mo Codex: (.+)$/,
    translate: ([, name]) => `Mở Codex: ${name}`,
  },
  {
    pattern: /^Mo workspace cho (.+)$/,
    translate: ([, name]) => `Mở workspace cho ${name}`,
  },
  {
    pattern: /^Cap nhat (.+)$/,
    translate: ([, version]) => `Cập nhật ${version}`,
  },
  {
    pattern: /^Tim thay (.+)$/,
    translate: ([, version]) => `Tìm thấy ${version}`,
  },
  {
    pattern: /^Dang tai (\d+)%$/,
    translate: ([, percent]) => `Đang tải ${percent}%`,
  },
  {
    pattern: /^San sang cai (.+)$/,
    translate: ([, version]) => `Sẵn sàng cài ${version}`,
  },
  {
    pattern: /^Da tim thay ban moi (.+)\. Dang tai ve\.\.\.$/,
    translate: ([, version]) => `Đã tìm thấy bản mới ${version}. Đang tải về...`,
  },
  {
    pattern: /^Dang tai ban (.+)\.\.\. (\d+)%$/,
    translate: ([, version, percent]) => `Đang tải bản ${version}... ${percent}%`,
  },
  {
    pattern: /^Da tai xong ban (.+)\. Bam cai dat de khoi dong lai app\.$/,
    translate: ([, version]) =>
      `Đã tải xong bản ${version}. Bấm cài đặt để khởi động lại app.`,
  },
  {
    pattern: /^Da xoa (.+)\.$/,
    translate: ([, name]) => `Đã xóa ${name}.`,
  },
  {
    pattern: /^Da xuat JSON ra (.+)\.$/,
    translate: ([, path]) => `Đã xuất JSON ra ${path}.`,
  },
  {
    pattern: /^Da nap du lieu tu (.+)\.$/,
    translate: ([, path]) => `Đã nạp dữ liệu từ ${path}.`,
  },
  {
    pattern: /^Da yeu cau he dieu hanh mo (.+)\.$/,
    translate: ([, label]) => `Đã yêu cầu hệ điều hành mở ${label}.`,
  },
  {
    pattern: /^Da mo profile Codex cua (.+)\.$/,
    translate: ([, name]) => `Đã mở profile Codex của ${name}.`,
  },
  {
    pattern: /^Da cap nhat profile cho (.+), nhung slot nay dang trung account voi (.+)\.$/,
    translate: ([, name, duplicate]) =>
      `Đã cập nhật profile cho ${name}, nhưng slot này đang trùng account với ${duplicate}.`,
  },
  {
    pattern: /^Da cap nhat profile Codex cho (.+)\.$/,
    translate: ([, name]) => `Đã cập nhật profile Codex cho ${name}.`,
  },
  {
    pattern: /^Chan doan (.+): (.+)$/,
    translate: ([, name, summary]) => `Chẩn đoán ${name}: ${summary}`,
  },
  {
    pattern: /^Da import backup chat cho (.+)\.$/,
    translate: ([, name]) => `Đã import backup chat cho ${name}.`,
  },
  {
    pattern: /^Chua co (.+) de copy\.$/,
    translate: ([, label]) => `Chưa có ${label} để copy.`,
  },
  {
    pattern: /^Da copy (.+)\.$/,
    translate: ([, label]) => `Đã copy ${label}.`,
  },
  {
    pattern: /^Khong copy duoc (.+)\.$/,
    translate: ([, label]) => `Không copy được ${label}.`,
  },
  {
    pattern:
      /^Da mo session rieng cho (.+)\. Dang nhap trong cua so do, cookies se duoc giu theo partition rieng\.$/,
    translate: ([, name]) =>
      `Đã mở session riêng cho ${name}. Đăng nhập trong cửa sổ đó, cookies sẽ được giữ theo partition riêng.`,
  },
  {
    pattern:
      /^Da mo trang Billing cho (.+)\. Neu ban la owner\/admin cua workspace, ban co the xem invoice va chu ky billing ngay trong modal nay\.$/,
    translate: ([, name]) =>
      `Đã mở trang Billing cho ${name}. Nếu bạn là owner/admin của workspace, bạn có thể xem invoice và chu kỳ billing ngay trong modal này.`,
  },
  {
    pattern:
      /^Da mo trang Account cho (.+)\. Renewal date cua goi ca nhan thuong nam ngay trong modal nay; neu can thao tac billing them thi bam Manage\.$/,
    translate: ([, name]) =>
      `Đã mở trang Account cho ${name}. Renewal date của gói cá nhân thường nằm ngay trong modal này; nếu cần thao tác billing thêm thì bấm Manage.`,
  },
  {
    pattern: /^Khong doc duoc renewal date cho (.+)\.$/,
    translate: ([, name]) => `Không đọc được renewal date cho ${name}.`,
  },
  {
    pattern: /^Da dien Gia han (.+) cho (.+?)(?: \((.+)\))?\.$/,
    translate: ([, date, name, source]) => {
      const sourceSuffix = source ? ` (${source})` : ''
      return `Đã điền Gia hạn ${date} cho ${name}${sourceSuffix}.`
    },
  },
  {
    pattern: /^Da xoa session rieng cua (.+)\. Mo lai cua so session de dang nhap tai khoan nay\.$/,
    translate: ([, name]) =>
      `Đã xóa session riêng của ${name}. Mở lại cửa sổ session để đăng nhập tài khoản này.`,
  },
  {
    pattern: /^Da dong bo thong tin session cho (.+)\.$/,
    translate: ([, name]) => `Đã đồng bộ thông tin session cho ${name}.`,
  },
  {
    pattern: /^Hien dang mo profile cua (.+)\. Ban dang xem slot (.+)\.$/,
    translate: ([, active, viewing]) =>
      `Hiện đang mở profile của ${active}. Bạn đang xem slot ${viewing}.`,
  },
  {
    pattern: /^Khong mo duoc (.+)\.$/,
    translate: ([, target]) => `Không mở được ${target}.`,
  },
  {
    pattern: /^Khong doc duoc (.+)\.$/,
    translate: ([, target]) => `Không đọc được ${target}.`,
  },
  {
    pattern: /^(\d+) chats tu (.+)$/,
    translate: ([, chats, importedAt]) => `${chats} chats từ ${importedAt}`,
  },
]

const dynamicRules: DynamicRule[] = [
  {
    pattern: /^Qua han (\d+) ngay$/,
    translate: ([, days]) =>
      entry(
        `Expired ${days} days ago`,
        `${days}日前に期限切れ`,
        `已过期 ${days} 天`,
        `${days} दिन पहले समाप्त`,
        `${days}일 전에 만료`,
      ),
  },
  {
    pattern: /^(\d+) ngay nua$/,
    translate: ([, days]) =>
      entry(
        `In ${days} days`,
        `${days}日後`,
        `${days} 天后`,
        `${days} दिन बाद`,
        `${days}일 후`,
      ),
  },
  {
    pattern: /^Dong bo (.+)$/,
    translate: ([, value]) =>
      entry(
        `Synced ${value}`,
        `${value} に同期`,
        `已同步 ${value}`,
        `${value} पर सिंक`,
        `${value}에 동기화`,
      ),
  },
  {
    pattern: /^Session gan nhat (.+)$/,
    translate: ([, value]) =>
      entry(
        `Last session ${value}`,
        `直近のセッション ${value}`,
        `最近会话 ${value}`,
        `पिछला सत्र ${value}`,
        `최근 세션 ${value}`,
      ),
  },
  {
    pattern: /^Profile (.+)$/,
    translate: ([, value]) =>
      entry(
        `Profile ${value}`,
        `プロフィール ${value}`,
        `配置 ${value}`,
        `प्रोफ़ाइल ${value}`,
        `프로필 ${value}`,
      ),
  },
  {
    pattern: /^Trong (\d+) ngay toi$/,
    translate: ([, days]) =>
      entry(
        `Within the next ${days} days`,
        `今後${days}日以内`,
        `未来 ${days} 天内`,
        `अगले ${days} दिनों के भीतर`,
        `앞으로 ${days}일 이내`,
      ),
  },
  {
    pattern: /^(\d+) slot dang Active$/,
    translate: ([, count]) =>
      entry(
        `${count} active slots`,
        `稼働中スロット ${count}`,
        `${count} 个活跃槽位`,
        `${count} सक्रिय स्लॉट`,
        `활성 슬롯 ${count}개`,
      ),
  },
  {
    pattern: /^(\d+) slot o vai tro Primary$/,
    translate: ([, count]) =>
      entry(
        `${count} slots in Primary role`,
        `Primary ロールのスロット ${count}`,
        `${count} 个 Primary 槽位`,
        `Primary भूमिका में ${count} स्लॉट`,
        `Primary 역할 슬롯 ${count}개`,
      ),
  },
  {
    pattern: /^(\d+) slot dang hien thi$/,
    translate: ([, count]) =>
      entry(
        `${count} visible slots`,
        `表示中スロット ${count}`,
        `显示中的槽位 ${count}`,
        `${count} दृश्यमान स्लॉट`,
        `표시 중인 슬롯 ${count}개`,
      ),
  },
  {
    pattern: /^Account dang chon cho profile Codex: (.+)\.$/,
    translate: ([, name]) =>
      entry(
        `Selected account for Codex profile: ${name}.`,
        `Codex プロフィールに選択されたアカウント: ${name}。`,
        `当前选作 Codex 配置的账号：${name}。`,
        `Codex प्रोफ़ाइल के लिए चुना गया अकाउंट: ${name}।`,
        `Codex 프로필에 선택된 계정: ${name}.`,
      ),
  },
  {
    pattern: /^Xoa "(.+)" khoi dashboard nay\?$/,
    translate: ([, name]) =>
      entry(
        `Remove "${name}" from this dashboard?`,
        `このダッシュボードから「${name}」を削除しますか？`,
        `要从此仪表板中移除“${name}”吗？`,
        `क्या "${name}" को इस डैशबोर्ड से हटाना है?`,
        `이 대시보드에서 "${name}"을(를) 제거할까요?`,
      ),
  },
  {
    pattern:
      /^Reset session rieng cua "(.+)"\? Thao tac nay se xoa cookies va buoc dang nhap lai\.$/,
    translate: ([, name]) =>
      entry(
        `Reset the isolated session for "${name}"? This will clear cookies and require login again.`,
        `「${name}」の分離セッションをリセットしますか？ Cookie が削除され、再ログインが必要になります。`,
        `要重置“${name}”的独立会话吗？这会清除 Cookie 并要求重新登录。`,
        `क्या "${name}" का अलग सत्र रीसेट करना है? इससे कुकी साफ होंगी और फिर से लॉगिन करना होगा।`,
        `"${name}"의 분리 세션을 재설정할까요? 쿠키가 삭제되고 다시 로그인해야 합니다.`,
      ),
  },
  {
    pattern: /^Mo Codex: (.+)$/,
    translate: ([, name]) =>
      entry(
        `Open Codex: ${name}`,
        `Codex を開く: ${name}`,
        `打开 Codex：${name}`,
        `Codex खोलें: ${name}`,
        `Codex 열기: ${name}`,
      ),
  },
  {
    pattern: /^Mo workspace cho (.+)$/,
    translate: ([, name]) =>
      entry(
        `Open workspace for ${name}`,
        `${name} のワークスペースを開く`,
        `打开 ${name} 的工作区`,
        `${name} के लिए वर्कस्पेस खोलें`,
        `${name}의 워크스페이스 열기`,
      ),
  },
  {
    pattern: /^Cap nhat (.+)$/,
    translate: ([, version]) =>
      entry(
        `Update ${version}`,
        `アップデート ${version}`,
        `更新 ${version}`,
        `अपडेट ${version}`,
        `업데이트 ${version}`,
      ),
  },
  {
    pattern: /^Tim thay (.+)$/,
    translate: ([, version]) =>
      entry(
        `Found ${version}`,
        `${version} を検出`,
        `发现 ${version}`,
        `${version} मिला`,
        `${version} 발견`,
      ),
  },
  {
    pattern: /^Dang tai (\d+)%$/,
    translate: ([, percent]) =>
      entry(
        `Downloading ${percent}%`,
        `ダウンロード中 ${percent}%`,
        `下载中 ${percent}%`,
        `डाउनलोड ${percent}%`,
        `다운로드 중 ${percent}%`,
      ),
  },
  {
    pattern: /^San sang cai (.+)$/,
    translate: ([, version]) =>
      entry(
        `Ready to install ${version}`,
        `${version} をインストール可能`,
        `准备安装 ${version}`,
        `${version} इंस्टॉल के लिए तैयार`,
        `${version} 설치 준비 완료`,
      ),
  },
  {
    pattern: /^Da tim thay ban moi (.+)\. Dang tai ve\.\.\.$/,
    translate: ([, version]) =>
      entry(
        `Found version ${version}. Downloading now...`,
        `バージョン ${version} を検出しました。ダウンロード中...`,
        `发现版本 ${version}，正在下载...`,
        `संस्करण ${version} मिला। अभी डाउनलोड हो रहा है...`,
        `버전 ${version}을 찾았습니다. 다운로드 중...`,
      ),
  },
  {
    pattern: /^Dang tai ban (.+)\.\.\. (\d+)%$/,
    translate: ([, version, percent]) =>
      entry(
        `Downloading ${version}... ${percent}%`,
        `${version} をダウンロード中... ${percent}%`,
        `正在下载 ${version}... ${percent}%`,
        `${version} डाउनलोड हो रहा है... ${percent}%`,
        `${version} 다운로드 중... ${percent}%`,
      ),
  },
  {
    pattern: /^Da tai xong ban (.+)\. Bam cai dat de khoi dong lai app\.$/,
    translate: ([, version]) =>
      entry(
        `Version ${version} has been downloaded. Install it to restart the app.`,
        `バージョン ${version} のダウンロードが完了しました。インストールしてアプリを再起動してください。`,
        `版本 ${version} 已下载完成。安装后将重启应用。`,
        `संस्करण ${version} डाउनलोड हो चुका है। इंस्टॉल करके ऐप रीस्टार्ट करें।`,
        `버전 ${version} 다운로드가 완료되었습니다. 설치하면 앱이 다시 시작됩니다.`,
      ),
  },
  {
    pattern: /^Da xoa (.+)\.$/,
    translate: ([, name]) =>
      entry(
        `Deleted ${name}.`,
        `${name} を削除しました。`,
        `已删除 ${name}。`,
        `${name} हटा दिया गया।`,
        `${name}을(를) 삭제했습니다.`,
      ),
  },
  {
    pattern: /^Da xuat JSON ra (.+)\.$/,
    translate: ([, path]) =>
      entry(
        `Exported JSON to ${path}.`,
        `JSON を ${path} に書き出しました。`,
        `已将 JSON 导出到 ${path}。`,
        `JSON को ${path} पर निर्यात किया गया।`,
        `JSON을 ${path}에 내보냈습니다.`,
      ),
  },
  {
    pattern: /^Da nap du lieu tu (.+)\.$/,
    translate: ([, path]) =>
      entry(
        `Loaded data from ${path}.`,
        `${path} からデータを読み込みました。`,
        `已从 ${path} 加载数据。`,
        `${path} से डेटा लोड किया गया।`,
        `${path}에서 데이터를 불러왔습니다.`,
      ),
  },
  {
    pattern: /^Da yeu cau he dieu hanh mo (.+)\.$/,
    translate: ([, label]) =>
      entry(
        `Requested the OS to open ${label}.`,
        `OS に ${label} を開くよう依頼しました。`,
        `已请求系统打开 ${label}。`,
        `OS से ${label} खोलने का अनुरोध किया गया।`,
        `OS에 ${label} 열기를 요청했습니다.`,
      ),
  },
  {
    pattern: /^Da mo profile Codex cua (.+)\.$/,
    translate: ([, name]) =>
      entry(
        `Opened the Codex profile for ${name}.`,
        `${name} の Codex プロフィールを開きました。`,
        `已打开 ${name} 的 Codex 配置。`,
        `${name} के लिए Codex प्रोफ़ाइल खोल दी गई।`,
        `${name}의 Codex 프로필을 열었습니다.`,
      ),
  },
  {
    pattern: /^Da cap nhat profile cho (.+), nhung slot nay dang trung account voi (.+)\.$/,
    translate: ([, name, duplicate]) =>
      entry(
        `Updated the profile for ${name}, but this slot matches the same account as ${duplicate}.`,
        `${name} のプロフィールを更新しましたが、このスロットは ${duplicate} と同じアカウントに一致しています。`,
        `已更新 ${name} 的配置，但此槽位与 ${duplicate} 指向同一个账号。`,
        `${name} की प्रोफ़ाइल अपडेट हो गई, लेकिन यह स्लॉट ${duplicate} वाले उसी अकाउंट से मेल खाता है।`,
        `${name}의 프로필을 업데이트했지만 이 슬롯은 ${duplicate}와 같은 계정으로 겹칩니다.`,
      ),
  },
  {
    pattern: /^Da cap nhat profile Codex cho (.+)\.$/,
    translate: ([, name]) =>
      entry(
        `Updated the Codex profile for ${name}.`,
        `${name} の Codex プロフィールを更新しました。`,
        `已更新 ${name} 的 Codex 配置。`,
        `${name} के लिए Codex प्रोफ़ाइल अपडेट की गई।`,
        `${name}의 Codex 프로필을 업데이트했습니다.`,
      ),
  },
  {
    pattern: /^Chan doan (.+): (.+)$/,
    translate: ([, name, summary]) =>
      entry(
        `Diagnostics for ${name}: ${summary}`,
        `${name} の診断: ${summary}`,
        `${name} 的诊断: ${summary}`,
        `${name} के लिए निदान: ${summary}`,
        `${name} 진단: ${summary}`,
      ),
  },
  {
    pattern: /^Da import backup chat cho (.+)\.$/,
    translate: ([, name]) =>
      entry(
        `Imported chat backup for ${name}.`,
        `${name} のチャットバックアップを取り込みました。`,
        `已为 ${name} 导入聊天备份。`,
        `${name} के लिए चैट बैकअप आयात किया गया।`,
        `${name}의 채팅 백업을 가져왔습니다.`,
      ),
  },
  {
    pattern: /^Chua co (.+) de copy\.$/,
    translate: ([, label]) =>
      entry(
        `There is no ${label} to copy.`,
        `コピーする ${label} がありません。`,
        `没有可复制的 ${label}。`,
        `कॉपी करने के लिए ${label} नहीं है।`,
        `복사할 ${label}이(가) 없습니다.`,
      ),
  },
  {
    pattern: /^Da copy (.+)\.$/,
    translate: ([, label]) =>
      entry(
        `Copied ${label}.`,
        `${label} をコピーしました。`,
        `已复制 ${label}。`,
        `${label} कॉपी किया गया।`,
        `${label}을(를) 복사했습니다.`,
      ),
  },
  {
    pattern: /^Khong copy duoc (.+)\.$/,
    translate: ([, label]) =>
      entry(
        `Could not copy ${label}.`,
        `${label} をコピーできませんでした。`,
        `无法复制 ${label}。`,
        `${label} कॉपी नहीं किया जा सका।`,
        `${label}을(를) 복사할 수 없습니다.`,
      ),
  },
  {
    pattern: /^Da mo session rieng cho (.+)\. Dang nhap trong cua so do, cookies se duoc giu theo partition rieng\.$/,
    translate: ([, name]) =>
      entry(
        `Opened the isolated session for ${name}. Log in inside that window and its cookies will stay in a separate partition.`,
        `${name} 用の分離セッションを開きました。そのウィンドウでログインすると Cookie は別パーティションに保持されます。`,
        `已为 ${name} 打开独立会话。请在该窗口中登录，Cookie 会保存在独立分区中。`,
        `${name} के लिए अलग सत्र खोला गया। उस विंडो में लॉगिन करें, कुकी अलग पार्टिशन में बनी रहेंगी।`,
        `${name}용 분리 세션을 열었습니다. 그 창에서 로그인하면 쿠키가 별도 파티션에 유지됩니다.`,
      ),
  },
  {
    pattern: /^Da mo trang Billing cho (.+)\. Neu ban la owner\/admin cua workspace, ban co the xem invoice va chu ky billing ngay trong cua so nay\.$/,
    translate: ([, name]) =>
      entry(
        `Opened the Billing page for ${name}. If you are the workspace owner/admin, you can view invoices and billing cycles in this window.`,
        `${name} の Billing ページを開きました。ワークスペースの owner/admin であれば、このウィンドウで請求書と請求サイクルを確認できます。`,
        `已为 ${name} 打开 Billing 页面。如果你是工作区 owner/admin，可直接在此窗口查看发票和计费周期。`,
        `${name} के लिए Billing पेज खोला गया। यदि आप workspace owner/admin हैं, तो इसी विंडो में invoice और billing cycle देख सकते हैं।`,
        `${name}의 Billing 페이지를 열었습니다. 워크스페이스 owner/admin이면 이 창에서 청구서와 결제 주기를 볼 수 있습니다.`,
      ),
  },
  {
    pattern: /^Da mo trang Account cho (.+)\. Renewal date cua goi ca nhan thuong nam ngay trong modal nay; neu can thao tac billing them thi bam Manage\.$/,
    translate: ([, name]) =>
      entry(
        `Opened the Account page for ${name}. Personal-plan renewal dates are usually shown in this modal; press Manage if you need more billing actions.`,
        `${name} の Account ページを開きました。個人プランの更新日は通常このモーダル内に表示されます。追加の請求操作が必要なら Manage を押してください。`,
        `已为 ${name} 打开 Account 页面。个人套餐的续费日期通常显示在此弹窗中；如需更多计费操作请点击 Manage。`,
        `${name} के लिए Account पेज खोला गया। व्यक्तिगत प्लान की renewal date आमतौर पर इसी modal में होती है; और billing करना हो तो Manage दबाएँ।`,
        `${name}의 Account 페이지를 열었습니다. 개인 플랜 갱신일은 보통 이 모달에 표시되며, 추가 결제 작업이 필요하면 Manage를 누르세요.`,
      ),
  },
  {
    pattern: /^Khong doc duoc renewal date cho (.+)\.$/,
    translate: ([, name]) =>
      entry(
        `Could not read the renewal date for ${name}.`,
        `${name} の更新日を読めませんでした。`,
        `无法读取 ${name} 的续费日期。`,
        `${name} की renewal date नहीं पढ़ी जा सकी।`,
        `${name}의 갱신일을 읽을 수 없습니다.`,
      ),
  },
  {
    pattern: /^Da dien Gia han (.+) cho (.+?)(?: \((.+)\))?\.$/,
    translate: ([, date, name, source]) => {
      const sourceSuffix = source ? ` (${source})` : ''
      return entry(
        `Filled renewal ${date} for ${name}${sourceSuffix}.`,
        `${name} の更新日 ${date}${sourceSuffix} を入力しました。`,
        `已为 ${name} 填入续费日期 ${date}${sourceSuffix}。`,
        `${name} के लिए renewal ${date}${sourceSuffix} भर दी गई।`,
        `${name}에 갱신일 ${date}${sourceSuffix}을(를) 채웠습니다.`,
      )
    },
  },
  {
    pattern: /^Da xoa session rieng cua (.+)\. Mo lai cua so session de dang nhap tai khoan nay\.$/,
    translate: ([, name]) =>
      entry(
        `Cleared the isolated session for ${name}. Open the session window again to log back into this account.`,
        `${name} の分離セッションを削除しました。このアカウントに再ログインするにはセッションウィンドウを開き直してください。`,
        `已清除 ${name} 的独立会话。请重新打开会话窗口并重新登录该账号。`,
        `${name} का अलग सत्र साफ कर दिया गया। इस अकाउंट में फिर लॉगिन करने के लिए सत्र विंडो दोबारा खोलें।`,
        `${name}의 분리 세션을 지웠습니다. 이 계정에 다시 로그인하려면 세션 창을 다시 여세요.`,
      ),
  },
  {
    pattern: /^Da dong bo thong tin session cho (.+)\.$/,
    translate: ([, name]) =>
      entry(
        `Synced session information for ${name}.`,
        `${name} のセッション情報を同期しました。`,
        `已同步 ${name} 的会话信息。`,
        `${name} की सत्र जानकारी सिंक कर दी गई।`,
        `${name}의 세션 정보를 동기화했습니다.`,
      ),
  },
  {
    pattern: /^Hien dang mo profile cua (.+)\. Ban dang xem slot (.+)\.$/,
    translate: ([, active, viewing]) =>
      entry(
        `The currently open profile belongs to ${active}. You are viewing slot ${viewing}.`,
        `現在開いているプロフィールは ${active} のものです。表示中のスロットは ${viewing} です。`,
        `当前打开的配置属于 ${active}。你正在查看槽位 ${viewing}。`,
        `अभी खुला प्रोफ़ाइल ${active} का है। आप ${viewing} स्लॉट देख रहे हैं।`,
        `현재 열려 있는 프로필은 ${active}의 것입니다. 지금 보고 있는 슬롯은 ${viewing}입니다.`,
      ),
  },
  {
    pattern: /^Khong mo duoc (.+)\.$/,
    translate: ([, target]) =>
      entry(
        `Could not open ${target}.`,
        `${target} を開けませんでした。`,
        `无法打开 ${target}。`,
        `${target} नहीं खोला जा सका।`,
        `${target}을(를) 열 수 없습니다.`,
      ),
  },
  {
    pattern: /^Khong doc duoc (.+)\.$/,
    translate: ([, target]) =>
      entry(
        `Could not read ${target}.`,
        `${target} を読めませんでした。`,
        `无法读取 ${target}。`,
        `${target} नहीं पढ़ा जा सका।`,
        `${target}을(를) 읽을 수 없습니다.`,
      ),
  },
  {
    pattern: /^(\d+) chats · (\d+) messages$/,
    translate: ([, chats, messages]) =>
      entry(
        `${chats} chats · ${messages} messages`,
        `${chats}件のチャット · ${messages}件のメッセージ`,
        `${chats} 个聊天 · ${messages} 条消息`,
        `${chats} चैट · ${messages} संदेश`,
        `채팅 ${chats}개 · 메시지 ${messages}개`,
      ),
  },
  {
    pattern: /^(\d+) chats tu (.+)$/,
    translate: ([, chats, importedAt]) =>
      entry(
        `${chats} chats from ${importedAt}`,
        `${importedAt} から ${chats}件のチャット`,
        `来自 ${importedAt} 的 ${chats} 个聊天`,
        `${importedAt} से ${chats} चैट`,
        `${importedAt} 기준 채팅 ${chats}개`,
      ),
  },
  {
    pattern: /^Codex (\d+[a-z])$/i,
    translate: ([, window]) =>
      entry(
        `Codex ${window}`,
        `Codex ${window}`,
        `Codex ${window}`,
        `Codex ${window}`,
        `Codex ${window}`,
      ),
  },
  {
    pattern: /^Reset (\d+[a-z])$/i,
    translate: ([, window]) =>
      entry(
        `Reset ${window}`,
        `${window} リセット`,
        `${window} 重置`,
        `${window} रीसेट`,
        `${window} 리셋`,
      ),
  },
]

const translatableAttributes: TranslatableAttribute[] = [
  'placeholder',
  'title',
  'aria-label',
]

export const languageLabels: Record<AppLanguage, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  ja: '日本語',
  'zh-CN': '中文',
  hi: 'हिन्दी',
  ko: '한국어',
}

export function syncActiveLanguage(language: AppLanguage) {
  activeLanguage = language
}

export function getIntlLocale(language = activeLanguage) {
  return localeByLanguage[language]
}

function normalizeVietnameseKey(source: string) {
  return source
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

function translateTrimmed(source: string, language: AppLanguage) {
  if (!source) {
    return source
  }

  const normalizedSource = normalizeVietnameseKey(source)

  if (language === 'vi') {
    const exactVi = vietnameseAccentedTranslations[source] ?? vietnameseAccentedTranslations[normalizedSource]
    if (exactVi) {
      return exactVi
    }

    for (const rule of vietnameseDynamicRules) {
      const match = normalizedSource.match(rule.pattern)
      if (!match) {
        continue
      }
      return rule.translate(match)
    }

    return source
  }

  const exact =
    exactTranslations[source]?.[language] ??
    exactTranslations[normalizedSource]?.[language]
  if (exact) {
    return exact
  }

  for (const rule of dynamicRules) {
    const match = source.match(rule.pattern) ?? normalizedSource.match(rule.pattern)
    if (!match) {
      continue
    }

    const translated = rule.translate(match)[language]
    if (translated) {
      return translated
    }
  }

  return source
}

function preserveWhitespace(source: string, translated: string) {
  const leading = source.match(/^\s*/)?.[0] ?? ''
  const trailing = source.match(/\s*$/)?.[0] ?? ''
  return `${leading}${translated}${trailing}`
}

function translateWithWhitespace(source: string, language: AppLanguage) {
  const trimmed = source.trim()
  if (!trimmed) {
    return source
  }

  return preserveWhitespace(source, translateTrimmed(trimmed, language))
}

export function translateMessage(source: string, language = activeLanguage) {
  return translateWithWhitespace(source, language)
}

function getRenderedVariants(source: string) {
  return new Set(
    [source, ...appLanguages.map((language) => translateWithWhitespace(source, language))].filter(
      Boolean,
    ),
  )
}

function canTranslateTextNode(node: Text) {
  const parent = node.parentElement
  if (!parent) {
    return false
  }

  if (parent.closest('[data-no-localize]')) {
    return false
  }

  return !['CODE', 'PRE', 'TEXTAREA', 'SCRIPT', 'STYLE'].includes(parent.tagName)
}

function translateTextNode(node: Text, language: AppLanguage) {
  if (!canTranslateTextNode(node)) {
    return
  }

  const currentValue = node.textContent ?? ''
  if (!currentValue.trim()) {
    return
  }

  const previousSource = textSources.get(node)
  let source = previousSource ?? currentValue

  if (previousSource && !getRenderedVariants(previousSource).has(currentValue)) {
    source = currentValue
  }

  textSources.set(node, source)

  const localized = translateWithWhitespace(source, language)
  if (currentValue !== localized) {
    node.textContent = localized
  }
}

function translateElementAttributes(element: Element, language: AppLanguage) {
  if (element.closest('[data-no-localize]')) {
    return
  }

  const sources = attributeSources.get(element) ?? {}

  translatableAttributes.forEach((attribute) => {
    const currentValue = element.getAttribute(attribute) ?? ''
    if (!currentValue.trim()) {
      return
    }

    const previousSource = sources[attribute]
    let source = previousSource ?? currentValue

    if (previousSource && !getRenderedVariants(previousSource).has(currentValue)) {
      source = currentValue
    }

    sources[attribute] = source

    const localized = translateWithWhitespace(source, language)
    if (currentValue !== localized) {
      element.setAttribute(attribute, localized)
    }
  })

  attributeSources.set(element, sources)
}

export function localizeDom(root: HTMLElement, language: AppLanguage) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

  const textNodes: Text[] = []
  while (walker.nextNode()) {
    const textNode = walker.currentNode
    if (textNode instanceof Text) {
      textNodes.push(textNode)
    }
  }

  textNodes.forEach((node) => {
    translateTextNode(node, language)
  })

  translateElementAttributes(root, language)
  root
    .querySelectorAll<HTMLElement>('[placeholder], [title], [aria-label]')
    .forEach((element) => {
      translateElementAttributes(element, language)
    })
}
