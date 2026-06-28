#!/bin/bash

set -e

echo "========================================="
echo "LearnGrow CRM 一键部署脚本（无冲突版）"
echo "========================================="
echo ""
echo "✅ 独立目录: /var/www/learngrow-crm"
echo "✅ 独立端口: 3456（不占用80/8080/3000等常用端口）"
echo "✅ 不修改现有 Nginx/其他应用配置"
echo ""

APP_DIR="/var/www/learngrow-crm"
LOG_DIR="/var/log/learngrow-crm"
APP_PORT=3456

echo "[1/7] 更新系统包..."
sudo apt update -y

echo ""
echo "[2/7] 安装必要工具..."
sudo apt install -y git curl build-essential

echo ""
echo "[3/7] 检查 Node.js 环境..."
if ! command -v node &> /dev/null; then
    echo "安装 Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "Node.js 已安装，版本: $(node --version)"
fi

echo ""
echo "[4/7] 检查 PM2..."
if ! command -v pm2 &> /dev/null; then
    echo "安装 PM2..."
    sudo npm install -g pm2
    sudo pm2 startup systemd -u root || true
else
    echo "PM2 已安装，版本: $(pm2 --version)"
fi

echo ""
echo "[5/7] 准备应用目录..."
sudo mkdir -p $APP_DIR
sudo mkdir -p $LOG_DIR
sudo mkdir -p $APP_DIR/data

if [ -d "$APP_DIR/.git" ]; then
    echo "代码目录已存在，拉取最新代码..."
    cd $APP_DIR
    sudo git fetch origin
    sudo git reset --hard origin/main
else
    echo "克隆代码..."
    sudo rm -rf $APP_DIR
    sudo git clone https://github.com/caijuren/LearnGrow-CRM.git $APP_DIR
    cd $APP_DIR
fi

echo ""
echo "[6/7] 安装依赖并构建前端..."
cd $APP_DIR
sudo npm install
sudo npm run build

echo ""
echo "[7/7] 启动服务..."
cd $APP_DIR
sudo pm2 delete learngrow-crm 2>/dev/null || true
sudo pm2 start ecosystem.config.js
sudo pm2 save

echo ""
echo "========================================="
echo "✅ 部署完成！"
echo "========================================="
echo ""
echo "📱 访问地址: http://你的服务器IP:$APP_PORT"
echo ""
echo "⚠️  重要：请在腾讯云控制台防火墙/安全组中开放 TCP 端口 $APP_PORT"
echo ""
echo "📌 默认登录账号:"
echo "   用户名: admin"
echo "   密码: admin123"
echo ""
echo "🔧 常用命令:"
echo "   查看服务状态: pm2 status"
echo "   查看实时日志: pm2 logs learngrow-crm"
echo "   重启服务: pm2 restart learngrow-crm"
echo "   停止服务: pm2 stop learngrow-crm"
echo "   更新代码后重新部署: cd $APP_DIR && sudo ./deploy.sh"
echo ""
echo "💡 提示:"
echo "   - 此部署完全独立，不会影响服务器上的其他应用"
echo "   - 如果后续想通过80端口/域名访问，可以在现有Nginx中添加反向代理到 127.0.0.1:$APP_PORT"
echo ""
