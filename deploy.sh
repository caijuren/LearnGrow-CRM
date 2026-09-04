#!/bin/bash

SERVER_HOST="124.220.103.120"
SERVER_USER="ubuntu"
PROJECT_DIR="/var/www/learngrow-crm"
TMP_DIR="/tmp/learngrow-deploy"

echo "========================================"
echo "  乐学长打卡 - 服务器部署脚本"
echo "========================================"
echo ""
echo "📦 开始部署到服务器..."
echo ""

# 1. 先传到临时目录
echo "1️⃣ 上传代码到服务器..."
ssh $SERVER_USER@$SERVER_HOST "rm -rf $TMP_DIR && mkdir -p $TMP_DIR"

# 上传整个项目根目录（排除不需要的目录）
rsync -avz \
  -e "ssh -o StrictHostKeyChecking=no" \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='data' \
  --exclude='*.log' \
  --exclude='.git' \
  --exclude='.DS_Store' \
  --exclude='miniprogram' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.env.production' \
  --exclude='uploads' \
  --exclude='backups' \
  "/Users/grubby/Desktop/LearnGrow CRM/" \
  "$SERVER_USER@$SERVER_HOST:$TMP_DIR/"

echo "   ✅ 代码已上传"
echo ""

# 2. 在服务器上用sudo部署
echo "2️⃣ 安装构建并重启服务..."
ssh $SERVER_USER@$SERVER_HOST << ENDSSH
  sudo mkdir -p $PROJECT_DIR
  sudo rsync -a --delete \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='data' \
    --exclude='uploads' \
    --exclude='backups' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='.env.production' \
    $TMP_DIR/ $PROJECT_DIR/

  # 整个项目目录归 ubuntu，避免 npm/tsx 因 root 属主导致旧代码加载或 EACCES
  sudo chown -R ubuntu:ubuntu $PROJECT_DIR 2>/dev/null || true

  # 外部数据目录（DATA_DIR）也要归 ubuntu，否则 PM2 写数据库/上传会 EACCES
  DATA_DIR_PATH=\$(grep -E '^DATA_DIR=' $PROJECT_DIR/.env.production 2>/dev/null | cut -d'=' -f2-)
  if [ -n "\$DATA_DIR_PATH" ]; then
    sudo chown -R ubuntu:ubuntu "\$DATA_DIR_PATH" 2>/dev/null || true
    echo "   ✅ 数据目录已归 ubuntu：\$DATA_DIR_PATH"
  fi

  cd $PROJECT_DIR
  export NODE_ENV=production

  echo "   📦 安装依赖..."
  npm ci

  echo "   🔍 类型检查..."
  npm run check

  echo "   🔨 构建中..."
  npm run build

  echo "   🧪 生产预检..."
  npm run preflight:prod

  echo "   🔄 重载服务..."
  pm2 startOrReload ecosystem.config.cjs --only learngrow-crm --update-env
  pm2 save

  echo "   ✅ 验证API..."
  sleep 2
  curl -s http://localhost:3456/api/health
  echo ""

  rm -rf $TMP_DIR
ENDSSH

echo ""
echo "========================================"
echo "  🎉 部署完成！"
echo "========================================"
echo ""
