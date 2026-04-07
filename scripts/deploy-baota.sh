#!/bin/bash
# RepoLens 寶塔部署腳本
# 使用方式：bash scripts/deploy-baota.sh

set -e

echo "🔍 RepoLens 部署腳本"
echo "========================"

# 1. 檢查 Node.js 版本
NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ 需要 Node.js >= 20，當前版本：$(node -v 2>/dev/null || echo '未安裝')"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# 2. 檢查 pnpm
if ! command -v pnpm &> /dev/null; then
  echo "📦 安裝 pnpm..."
  npm install -g pnpm
fi
echo "✅ pnpm $(pnpm -v)"

# 3. 安裝依賴
echo "📦 安裝依賴..."
pnpm install --frozen-lockfile

# 4. 檢查 .env
if [ ! -f .env ] && [ ! -f .env.production ]; then
  echo "⚠️  未找到 .env 檔案，從 .env.example 複製..."
  cp .env.example .env
  # 自動生成 ENCRYPTION_KEY
  GENERATED_KEY=$(openssl rand -hex 32)
  sed -i "s/^ENCRYPTION_KEY=$/ENCRYPTION_KEY=${GENERATED_KEY}/" .env
  echo "✅ 已生成 ENCRYPTION_KEY"
  echo "⚠️  請編輯 .env 確認設定"
fi

# 5. 建立資料目錄
mkdir -p data/db data/repos data/uploads data/local-mounts
echo "✅ 資料目錄已建立"

# 6. 建置
echo "🔨 建置中..."
pnpm build

# 7. 推送 DB schema
echo "📊 初始化資料庫..."
pnpm db:push

# 8. 驗證 standalone
if [ -f .next/standalone/server.js ]; then
  echo "✅ Standalone 建置成功"
else
  echo "❌ Standalone 建置失敗，未找到 .next/standalone/server.js"
  exit 1
fi

echo ""
echo "========================"
echo "✅ 部署完成！"
echo ""
echo "啟動方式："
echo "  node .next/standalone/server.js"
echo ""
echo "或在寶塔 Node 項目管理器中設定："
echo "  啟動檔案：.next/standalone/server.js"
echo "  端口：${PORT:-3000}"
echo ""
echo "Nginx 反向代理建議設定："
echo "  proxy_buffering off;"
echo "  proxy_read_timeout 300s;"
echo "  proxy_set_header X-Accel-Buffering no;"
echo ""
echo "首次訪問將跳轉到 /setup 完成初始設定。"
