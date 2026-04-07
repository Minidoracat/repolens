![License](https://img.shields.io/badge/license-MIT-blue.svg)

# RepoLens

AI 驅動的代碼全景分析工具 — 一鍵洞悉任何項目的架構核心。

RepoLens 使用 AI Agent 分析代碼倉庫，生成可互動的 Mermaid 架構圖。支援多種資料來源：GitHub URL、本地路徑、ZIP 上傳。

> [English version](./README.md)

## 功能特色

- **AI Agent 架構分析**：多步驟 Agent pipeline，透過 tool calling 分析 repo 結構、生成架構說明、產出可互動架構圖
- **多資料來源**：GitHub 倉庫（公開 & 私有）、本地檔案路徑、ZIP 檔案上傳
- **互動式架構圖**：點擊節點導航到原始檔案；支援縮放、平移、匯出 PNG 或 Mermaid 原碼
- **多 LLM 供應商**：OpenAI、Anthropic、Google、Azure — 可依部署環境配置
- **自架部署**：單一 Node.js 應用 + SQLite，無需外部服務
- **國際化**：英文與繁體中文（next-intl）
- **認證系統**：內建密碼認證，API Key 加密儲存

## 技術堆疊

- **框架**：Next.js 16、React 19、TypeScript 6
- **樣式**：Tailwind CSS 4、ShadCN、Radix UI
- **資料庫**：SQLite (better-sqlite3) + Drizzle ORM
- **AI**：Vercel AI SDK v6（streamText + tool calling）
- **架構圖**：Mermaid + @mermaid-js/layout-elk
- **部署**：Node.js standalone（例如寶塔面板）

## 快速開始

1. Clone 並安裝依賴

```bash
git clone https://github.com/Minidoracat/repolens.git
cd repolens
pnpm install
```

2. 設定環境變數

```bash
cp .env.example .env
```

至少設定：
- `ENCRYPTION_KEY` — 用 `openssl rand -hex 32` 生成

3. 啟動開發伺服器

```bash
pnpm dev
```

4. 開啟 `http://localhost:3000`，完成設定精靈（設定密碼 + LLM 供應商配置）

## 環境變數

所有選項請見 [`.env.example`](./.env.example)。重要變數：

| 變數 | 說明 |
|------|------|
| `ENCRYPTION_KEY` | 必填。用於加密 DB 中 API Key 的 AES 金鑰 |
| `PORT` | 伺服器埠號（預設：3000） |
| `DATA_DIR` | 資料目錄（預設：./data） |
| `ALLOWED_LOCAL_PATHS` | 逗號分隔的本地路徑白名單 |

LLM 供應商設定在初次設定後透過 Web UI 配置。

## 專案結構

```
src/
  app/
    (public)/          # 登入、設定精靈
    (protected)/       # 主工作區（需認證）
    api/               # REST 端點（auth、projects、runs、settings、setup）
  server/
    agent/             # AI Agent runtime、prompts、LLM factory、tools
    auth/              # Session & 密碼認證
    db/                # SQLite schema、queries、client
    sources/           # 資料來源轉接器（GitHub、本地、ZIP）
    security/          # 加密、HKDF key 衍生
  components/          # React 元件（workspace、settings、UI）
  i18n/                # 國際化訊息
  features/runs/       # Run 管理邏輯
  lib/                 # 共用工具
  hooks/               # React hooks（useAgentStream 等）
```

## 開發

```bash
pnpm dev          # 以 Turbopack 啟動開發伺服器
pnpm check        # Lint + 型別檢查
pnpm test         # 執行 Vitest 測試
pnpm build        # 生產環境建置
pnpm db:studio    # Drizzle Studio（DB 瀏覽器）
```

## 部署

RepoLens 建置為 Next.js standalone output。寶塔面板部署範例請見 [`scripts/deploy-baota.sh`](./scripts/deploy-baota.sh)。

## 授權

MIT

## 致謝

原始 fork 自 Ahmed Khaleel 的 [GitDiagram](https://github.com/ahmedkhaleel2004/gitdiagram)。RepoLens 是完整重寫，採用不同的架構與功能設計。
