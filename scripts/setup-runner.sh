#!/bin/bash
# GitHub Actions Self-hosted Runner 安装脚本
# 用法: ./scripts/setup-runner.sh [--remove]

set -euo pipefail

# 配置变量
RUNNER_DIR="/opt/github-runner"
RUNNER_USER="github-runner"
SERVICE_NAME="github-runner"
REPO_URL="https://github.com/caijuren/LearnGrow-CRM"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}GitHub Actions Self-hosted Runner 安装工具${NC}"
echo -e "${GREEN}========================================${NC}"

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}错误: 需要 root 权限运行此脚本${NC}"
    echo "请使用: sudo $0"
    exit 1
fi

# 解析参数
REMOVE=false
for arg in "$@"; do
    case $arg in
        --remove)
            REMOVE=true
            shift
            ;;
    esac
done

# 卸载 Runner
if [ "$REMOVE" = true ]; then
    echo -e "${YELLOW}正在卸载 GitHub Actions Runner...${NC}"
    
    # 停止服务
    systemctl stop $SERVICE_NAME 2>/dev/null || true
    systemctl disable $SERVICE_NAME 2>/dev/null || true
    
    # 删除 systemd 服务文件
    rm -f /etc/systemd/system/$SERVICE_NAME.service
    systemctl daemon-reload
    
    # 从 GitHub 注销 runner
    if [ -d "$RUNNER_DIR" ]; then
        cd $RUNNER_DIR
        if [ -f "./config.sh" ]; then
            echo "正在从 GitHub 注销 runner..."
            su - $RUNNER_USER -c "cd $RUNNER_DIR && ./config.sh remove --token $(cat .runner_token 2>/dev/null || echo '')" 2>/dev/null || true
        fi
    fi
    
    # 删除用户和目录
    userdel -r $RUNNER_USER 2>/dev/null || true
    rm -rf $RUNNER_DIR
    
    echo -e "${GREEN}Runner 已卸载${NC}"
    exit 0
fi

# 创建专用用户
if ! id -u $RUNNER_USER >/dev/null 2>&1; then
    echo -e "${GREEN}创建系统用户: $RUNNER_USER${NC}"
    useradd -m -s /bin/bash -d $RUNNER_DIR $RUNNER_USER
else
    echo -e "${YELLOW}用户 $RUNNER_USER 已存在${NC}"
fi

# 创建 Runner 目录
mkdir -p $RUNNER_DIR
chown $RUNNER_USER:$RUNNER_USER $RUNNER_DIR

# 下载 GitHub Actions Runner
echo -e "${GREEN}下载 GitHub Actions Runner...${NC}"
cd $RUNNER_DIR

# 检测架构
ARCH=$(uname -m)
case $ARCH in
    x86_64) RUNNER_ARCH="x64" ;;
    aarch64) RUNNER_ARCH="arm64" ;;
    *) 
        echo -e "${RED}不支持的架构: $ARCH${NC}"
        exit 1
        ;;
esac

# 获取最新版本
RUNNER_VERSION=$(curl -s https://api.github.com/repos/actions/runner/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' | cut -c2-)
echo "最新版本: v$RUNNER_VERSION"

# 下载并解压
RUNNER_PACKAGE="actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
DOWNLOAD_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${RUNNER_PACKAGE}"

echo "下载地址: $DOWNLOAD_URL"
su - $RUNNER_USER -c "cd $RUNNER_DIR && curl -L -o $RUNNER_PACKAGE $DOWNLOAD_URL"
su - $RUNNER_USER -c "cd $RUNNER_DIR && tar xzf $RUNNER_PACKAGE"
rm -f $RUNNER_PACKAGE

# 配置 Runner
echo ""
echo -e "${YELLOW}请提供 GitHub Personal Access Token:${NC}"
echo "1. 访问: https://github.com/caijuren/LearnGrow-CRM/settings/actions/runners/new"
echo "2. 选择 Linux 平台"
echo "3. 复制 token"
echo ""
read -p "输入 token: " RUNNER_TOKEN

if [ -z "$RUNNER_TOKEN" ]; then
    echo -e "${RED}Token 不能为空${NC}"
    exit 1
fi

# 保存 token 用于后续注销
echo "$RUNNER_TOKEN" > $RUNNER_DIR/.runner_token
chmod 600 $RUNNER_DIR/.runner_token
chown $RUNNER_USER:$RUNNER_USER $RUNNER_DIR/.runner_token

echo -e "${GREEN}配置 Runner...${NC}"
su - $RUNNER_USER -c "cd $RUNNER_DIR && ./config.sh --url $REPO_URL --token $RUNNER_TOKEN --name $(hostname)-runner --work _work --labels linux,production"

# 创建 systemd 服务
echo -e "${GREEN}创建 systemd 服务...${NC}"
cat > /etc/systemd/system/$SERVICE_NAME.service <<EOF
[Unit]
Description=GitHub Actions Runner
After=network.target

[Service]
Type=simple
User=$RUNNER_USER
Group=$RUNNER_USER
WorkingDirectory=$RUNNER_DIR
ExecStart=$RUNNER_DIR/run.sh
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=DATA_DIR=/opt/learngrow-crm/data
Environment=DEPLOY_DIR=/opt/learngrow-crm

# 安全限制
NoNewPrivileges=true
ProtectSystem=true
ProtectHome=true
ReadWritePaths=$RUNNER_DIR /opt/learngrow-crm

[Install]
WantedBy=multi-user.target
EOF

# 重新加载 systemd 并启动服务
systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl start $SERVICE_NAME

# 检查服务状态
sleep 3
if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Runner 安装成功!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "服务状态: $(systemctl status $SERVICE_NAME --no-pager | head -n 3)"
    echo ""
    echo "常用命令:"
    echo "  查看状态: sudo systemctl status $SERVICE_NAME"
    echo "  查看日志: sudo journalctl -u $SERVICE_NAME -f"
    echo "  重启服务: sudo systemctl restart $SERVICE_NAME"
    echo "  停止服务: sudo systemctl stop $SERVICE_NAME"
    echo ""
    echo "Runner 目录: $RUNNER_DIR"
    echo "部署目录: /opt/learngrow-crm"
else
    echo -e "${RED}Runner 启动失败，请检查日志:${NC}"
    echo "sudo journalctl -u $SERVICE_NAME -n 50"
    exit 1
fi
