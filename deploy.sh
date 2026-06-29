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
  "/Users/grubby/Desktop/LearnGrow CRM/api/" \
  "$SERVER_USER@$SERVER_HOST:$TMP_DIR/api/"

rsync -avz \
  -e "ssh -o StrictHostKeyChecking=no" \
  --exclude='node_modules' \
  --exclude='dist' \
  "/Users/grubby/Desktop/LearnGrow CRM/shared/" \
  "$SERVER_USER@$SERVER_HOST:$TMP_DIR/shared/"

rsync -avz \
  -e "ssh -o StrictHostKeyChecking=no" \
  "/Users/grubby/Desktop/LearnGrow CRM/package.json" \
  "$SERVER_USER@$SERVER_HOST:$TMP_DIR/"

echo "   ✅ 代码已上传"
echo ""

# 2. 在服务器上用sudo部署
echo "2️⃣ 安装构建并重启服务..."
ssh $SERVER_USER@$SERVER_HOST << ENDSSH
  sudo cp -r $TMP_DIR/api/* $PROJECT_DIR/api/
  sudo cp -r $TMP_DIR/shared/* $PROJECT_DIR/shared/
  sudo cp $TMP_DIR/package.json $PROJECT_DIR/
  
  rm -rf $TMP_DIR
  
  cd $PROJECT_DIR
  
  echo "   📦 安装依赖..."
  sudo npm install
  
  echo "   🔨 构建中..."
  sudo npm run build
  
  echo "   🔄 重启服务..."
  sudo pm2 restart learngrow-crm --update-env
  
  echo "   ✅ 验证API..."
  sleep 2
  curl -s http://localhost:3456/api/health
  echo ""
ENDSSH

echo ""
echo "========================================"
echo "  🎉 部署完成！"
echo "========================================"
echo ""
