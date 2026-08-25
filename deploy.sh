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

rsync -avz \
  -e "ssh -o StrictHostKeyChecking=no" \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='data/*.db' \
  --exclude='*.log' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.env.production' \
  --exclude='uploads' \
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
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='.env.production' \
    $TMP_DIR/ $PROJECT_DIR/
  
  cd $PROJECT_DIR
  
  echo "   📦 安装依赖..."
  sudo npm ci

  echo "   🔍 类型检查和测试..."
  sudo npm run check
  sudo npm test
  
  echo "   🔨 构建中..."
  sudo npm run build

  echo "   🧪 生产预检..."
  sudo npm run preflight:prod
  
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
