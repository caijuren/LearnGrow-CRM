#!/bin/bash

# ============================================
# LearnGrow CRM - 服务器部署脚本
# ============================================
# 使用前请配置好 SSH 免密登录和服务器环境变量
# 服务器侧请创建 /etc/learngrow/deploy.env 文件，格式：
#   SERVER_HOST="你的服务器IP"
#   SERVER_USER="ssh用户名"
#   PROJECT_DIR="/var/www/learngrow-crm"
#   WX_APPID="你的微信AppID"
#   WX_SECRET="你的微信Secret"
# ============================================

set -e

ENV_FILE="/etc/learngrow/deploy.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 未找到环境配置文件: $ENV_FILE"
  echo "请在服务器上创建该文件并填入部署所需变量"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

APP_PORT=3456

echo "========================================="
echo "LearnGrow CRM 一键部署脚本（无冲突版）"
echo "========================================="
echo ""
echo "✅ 服务器: $SERVER_USER@$SERVER_HOST"
echo "✅ 部署目录: $PROJECT_DIR"
echo "✅ 独立端口: $APP_PORT（不占用80/8080/3000等常用端口）"
echo ""

echo "[1/5] 上传代码到服务器临时目录..."
TMP_DIR="/tmp/learngrow-deploy"
ssh $SERVER_USER@$SERVER_HOST "rm -rf $TMP_DIR && mkdir -p $TMP_DIR"

rsync -avz \
  -e "ssh -o StrictHostKeyChecking=no" \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='data/*.db' \
  --exclude='*.log' \
  --exclude='.git' \
  "./api/" \
  "$SERVER_USER@$SERVER_HOST:$TMP_DIR/api/"

rsync -avz \
  -e "ssh -o StrictHostKeyChecking=no" \
  --exclude='node_modules' \
  --exclude='dist' \
  "./shared/" \
  "$SERVER_USER@$SERVER_HOST:$TMP_DIR/shared/"

rsync -avz \
  -e "ssh -o StrictHostKeyChecking=no" \
  "./src/" \
  "$SERVER_USER@$SERVER_HOST:$TMP_DIR/src/"

rsync -avz \
  -e "ssh -o StrictHostKeyChecking=no" \
  --exclude='node_modules' \
  "./" \
  --exclude='api/' --exclude='shared/' --exclude='src/' \
  --exclude='data/' --exclude='miniprogram/' \
  --exclude='tests/' --exclude='.git/' --exclude='.trae/' \
  "$SERVER_USER@$SERVER_HOST:$TMP_DIR/"

echo ""
echo "[2/5] 在服务器上部署应用..."
ssh $SERVER_USER@$SERVER_HOST << ENDSSH
  set -e
  sudo cp -r $TMP_DIR/api/* $PROJECT_DIR/api/
  sudo cp -r $TMP_DIR/shared/* $PROJECT_DIR/shared/
  sudo cp -r $TMP_DIR/src/* $PROJECT_DIR/src/
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
  curl -s http://localhost:$APP_PORT/api/health
  echo ""
ENDSSH

echo ""
echo "[3/5] 同步环境变量到服务器..."
ssh $SERVER_USER@$SERVER_HOST "sudo mkdir -p /etc/learngrow && sudo tee /etc/learngrow/deploy.env > /dev/null << 'EOF'
SERVER_HOST=\"$SERVER_HOST\"
SERVER_USER=\"$SERVER_USER\"
PROJECT_DIR=\"$PROJECT_DIR\"
WX_APPID=\"$WX_APPID\"
WX_SECRET=\"$WX_SECRET\"
EOF
sudo chmod 600 /etc/learngrow/deploy.env"

echo ""
echo "========================================="
echo "✅ 部署完成！"
echo "========================================="
echo ""
echo "� 访问地址: http://$SERVER_HOST:$APP_PORT"
echo ""
echo "📌 默认登录账号:"
echo "   用户名: admin"
echo "   密码: admin123"
echo ""
echo "🔧 常用命令:"
echo "   查看服务状态: ssh $SERVER_USER@$SERVER_HOST 'pm2 status'"
echo "   查看实时日志: ssh $SERVER_USER@$SERVER_HOST 'pm2 logs learngrow-crm'"
echo "   重启服务: ssh $SERVER_USER@$SERVER_HOST 'pm2 restart learngrow-crm'"
echo ""
