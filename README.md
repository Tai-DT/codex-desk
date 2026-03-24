<p align="center">
  <img src="src/assets/app-icon.png" width="96" alt="Codex Desk" />
</p>

<h1 align="center">Codex Desk</h1>

<p align="center">
  <b>Desktop app to organize multiple ChatGPT Plus / Codex accounts across macOS and Windows.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue" />
  <img src="https://img.shields.io/badge/framework-Electron%20%2B%20React-purple" />
  <img src="https://img.shields.io/github/license/Tai-DT/codex-desk" />
</p>

---

## ✨ Features

- 🗂 Manage multiple ChatGPT Plus accounts in one place
- 🔐 Each account opens in its own isolated Electron session (separate cookies/storage)
- 🔄 Switch Codex CLI profiles without re-login
- 📦 Import/Export account data as JSON backups
- 🌍 Multi-language UI (Vietnamese, English, Japanese, Chinese, Korean, Hindi)
- 🎨 Dark/Light theme support
- 💾 Local-first — all data stored on your machine

---

## 📸 Screenshots

<!-- Add screenshots here -->

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Install & Run

```bash
git clone https://github.com/Tai-DT/codex-desk.git
cd codex-desk
npm install
npm run dev
```

### Build for Production

```bash
npm run build
```

---

## 📖 Usage Guide

<details>
<summary>🇻🇳 Tiếng Việt</summary>

### Hướng dẫn sử dụng

1. **Tạo account** — Tạo một account record cho từng tài khoản ChatGPT Plus.
2. **Gán thông tin** — Gán repo, profile path và launch command cho từng slot.
3. **Mở session** — Mở session riêng và đăng nhập thủ công một lần.
4. **Kiểm tra profile Codex** — Trong Codex local, login từng account 1 lần trong đúng profile của slot rồi bấm "Kiểm tra profile".
5. **Chuyển đổi nhanh** — Dùng Dashboard để mở lại Codex bằng profile account cần dùng, không cần đăng nhập lại.
6. **Chạy nền** — Đóng cửa sổ chính để app tiếp tục chạy nền; muốn tắt hẳn thì mở tray/menu bar và chọn Thoát.

</details>

<details>
<summary>🇺🇸 English</summary>

### Usage Guide

1. **Create account** — Create an account record for each ChatGPT Plus account.
2. **Assign info** — Assign repo, profile path and launch command for each slot.
3. **Open session** — Open a dedicated session and log in manually once.
4. **Check Codex profile** — In local Codex, log into each account once using the correct slot profile, then click "Check profile".
5. **Quick switch** — Use the Dashboard to reopen Codex with the desired account profile, no re-login needed.
6. **Background mode** — Close the main window to keep the app running in background; to fully quit, open tray/menu bar and select Quit.

</details>

<details>
<summary>🇯🇵 日本語</summary>

### 使い方ガイド

1. **アカウント作成** — 各ChatGPT Plusアカウントのレコードを作成します。
2. **情報の割り当て** — 各スロットにリポジトリ、プロファイルパス、起動コマンドを割り当てます。
3. **セッションを開く** — 専用セッションを開き、手動で一度ログインしてください。
4. **Codexプロファイル確認** — ローカルCodexで各アカウントにスロットのプロファイルで一度ログインし、「プロファイル確認」をクリックします。
5. **クイック切替** — ダッシュボードを使って必要なアカウントプロファイルでCodexを再起動。再ログイン不要です。
6. **バックグラウンドモード** — メインウィンドウを閉じてもアプリはバックグラウンドで動作。完全に終了するにはトレイ/メニューバーから「終了」を選択。

</details>

<details>
<summary>🇨🇳 中文</summary>

### 使用指南

1. **创建账号** — 为每个ChatGPT Plus账号创建一条记录。
2. **分配信息** — 为每个槽位分配仓库、配置文件路径和启动命令。
3. **打开会话** — 打开专用会话并手动登录一次。
4. **检查Codex配置** — 在本地Codex中，使用正确的槽位配置文件登录每个账号一次，然后点击"检查配置文件"。
5. **快速切换** — 使用仪表板以所需账号配置文件重新打开Codex，无需重新登录。
6. **后台模式** — 关闭主窗口后应用继续在后台运行；要完全退出，请打开托盘/菜单栏并选择退出。

</details>

<details>
<summary>🇰🇷 한국어</summary>

### 사용 가이드

1. **계정 생성** — 각 ChatGPT Plus 계정에 대한 레코드를 생성합니다.
2. **정보 할당** — 각 슬롯에 리포지토리, 프로필 경로 및 실행 명령을 할당합니다.
3. **세션 열기** — 전용 세션을 열고 수동으로 한 번 로그인하세요.
4. **Codex 프로필 확인** — 로컬 Codex에서 올바른 슬롯 프로필로 각 계정에 한 번 로그인한 후 "프로필 확인"을 클릭합니다.
5. **빠른 전환** — 대시보드를 사용하여 원하는 계정 프로필로 Codex를 다시 열 수 있으며, 재로그인이 필요 없습니다.
6. **백그라운드 모드** — 메인 창을 닫아도 앱은 백그라운드에서 계속 실행됩니다. 완전히 종료하려면 트레이/메뉴 바에서 종료를 선택하세요.

</details>

<details>
<summary>🇮🇳 हिन्दी</summary>

### उपयोग गाइड

1. **अकाउंट बनाएं** — प्रत्येक ChatGPT Plus खाते के लिए एक रिकॉर्ड बनाएं।
2. **जानकारी आवंटित करें** — प्रत्येक स्लॉट को रिपॉजिटरी, प्रोफाइल पथ और लॉन्च कमांड आवंटित करें।
3. **सत्र खोलें** — एक अलग सत्र खोलें और मैन्युअल रूप से एक बार लॉगिन करें।
4. **Codex प्रोफाइल जांचें** — स्थानीय Codex में, सही स्लॉट प्रोफाइल का उपयोग करके प्रत्येक खाते में एक बार लॉगिन करें, फिर "प्रोफाइल जांचें" पर क्लिक करें।
5. **त्वरित स्विच** — डैशबोर्ड का उपयोग करके वांछित खाता प्रोफाइल के साथ Codex को पुनः खोलें, पुनः लॉगिन की आवश्यकता नहीं है।
6. **बैकग्राउंड मोड** — मुख्य विंडो बंद करें और ऐप बैकग्राउंड में चलता रहेगा; पूरी तरह से बंद करने के लिए ट्रे/मेनू बार खोलें और बाहर निकलें चुनें।

</details>

---

## ❤️ Support / Ủng hộ

Nếu app hữu ích, bạn có thể ủng hộ tác giả qua các kênh bên dưới.  
If you find this app useful, you can support the author via the channels below.

<table>
<tr>
<td align="center" width="50%">

### 🏦 VietQR (Timo)

<img src="src/assets/qr-timo.jpg" width="220" alt="VietQR - Timo" />

**DO TAI** — Timo Digital Bank by BVBank

</td>
<td align="center" width="50%">

### 💛 Binance Pay

<img src="src/assets/qr-binance.jpg" width="280" alt="Binance Pay" />

**Nickname: Do Tai**  
Scan via Binance App to send

</td>
</tr>
</table>

<p align="center"><b>Cảm ơn sự ủng hộ của bạn! Thank you for your support! 🙏</b></p>

---

## 🛠 Tech Stack

- **Electron** + **Vite** + **React** + **TypeScript**
- Local file-based storage (JSON)
- i18n: 6 languages (VI, EN, JA, ZH, KO, HI)

## 📄 License

MIT © [Tai-DT](https://github.com/Tai-DT)
