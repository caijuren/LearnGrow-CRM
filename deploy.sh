#!/bin/bash

set -e

echo "========================================="
echo "LearnGrow CRM 一键部署脚本"
echo "========================================="

APP_DIR="/var/www/learngrow-crm"
LOG_DIR="/var/log/learngrow-crm"

echo ""
echo "[1/8] 更新系统包..."
sudo apt update -y

echo ""
echo "[2/8] 安装必要工具..."
sudo apt install -y git curl nginx build-essential

echo ""
echo "[3/8] 安装 Node.js 20.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "Node.js 已安装，版本: $(node --version)"
fi

echo ""
echo "[4/8] 安装 PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    sudo pm2 startup systemd -u root || true
else
    echo "PM2 已安装，版本: $(pm2 --version)"
fi

echo ""
echo "[5/8] 创建目录..."
sudo mkdir -p $APP_DIR
sudo mkdir -p $LOG_DIR
sudo mkdir -p $APP_DIR/data

if [ -d "$APP_DIR/.git" ]; then
    echo ""
    echo "[6/8] 代码目录已存在，拉取最新代码..."
    cd $APP_DIR
    sudo git fetch origin
    sudo git reset --hard origin/main
else
    echo ""
    echo "[6/8] 克隆代码..."
    sudo rm -rf $APP_DIR
    sudo git clone https://github.com/caijuren/LearnGrow-CRM.git $APP_DIR
    cd $APP_DIR
fi

echo ""
echo "[7/8] 安装依赖并构建..."
cd $APP_DIR
sudo npm install
sudo npm run build

echo ""
echo "[8/8] 配置 PM2 和 Nginx..."
sudo cp $APP_DIR/nginx.conf /etc/nginx/sites-available/learngrow-crm
sudo ln -sf /etc/nginx/sites-available/learngrow-crm /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo pm2 delete learngrow-crm 2>/dev/null || true
cd $APP_DIR
sudo pm2 start ecosystem.config.js
sudo pm2 save

sudo nginx -t
sudo systemctl restart nginx

echo ""
echo "========================================="
echo "✅ 部署完成！"
echo "========================================="
echo ""
echo "访问地址: http://你的服务器IP"
echo ""
echo "常用命令:"
echo "  查看服务状态: pm2 status"
echo "  查看日志: pm2 logs learngrow-crm"
echo "  重启服务: pm2 restart learngrow-crm"
echo "  更新代码后重新部署: 重新运行此脚本"
echo ""
