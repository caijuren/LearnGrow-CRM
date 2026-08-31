#!/bin/bash
# LearnGrow CRM 生产环境监控告警脚本
# 用法: ./monitor.sh [--quiet]
# 功能: 检查服务状态、数据完整性、备份状态等，异常时发送企业微信告警

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 配置变量
DEPLOY_DIR="${DEPLOY_DIR:-$HOME/learngrow-crm}"
DATA_DIR="$DEPLOY_DIR/data"
BACKUP_DIR="$DEPLOY_DIR/backups"
WEBHOOK_URL="${WECHAT_WEBHOOK_URL:-}"
QUIET="${1:-}"  # --quiet 模式只输出错误

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=()
WARNINGS=[]

log_info() {
    if [ -z "$QUIET" ]; then
        echo -e "${GREEN}[INFO]${NC} $1"
    fi
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    WARNINGS+=("$1")
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ERRORS+=("$1")
}

# 发送告警
send_alert() {
    local message="$1"
    local msg_type="${2:-warning}"

    if [ -n "$WEBHOOK_URL" ]; then
        bash "$SCRIPT_DIR/wechat-alert.sh" "$message" "$msg_type" || true
    else
        echo "警告: WECHAT_WEBHOOK_URL 未配置，跳过企业微信通知"
    fi
}

echo "========================================="
echo "LearnGrow CRM 健康检查"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="

# 1. 检查服务状态
log_info "检查服务状态..."
if curl -f http://localhost:3456/api/health > /dev/null 2>&1; then
    log_info "✓ 服务运行正常"
else
    log_error "✗ 服务无响应！"
    send_alert "服务健康检查失败，请立即检查 PM2 状态和日志" "danger"
fi

# 2. 检查数据库文件
log_info "检查数据库文件..."
if [ ! -f "$DATA_DIR/learngrow.db" ]; then
    log_error "✗ 数据库文件不存在: $DATA_DIR/learngrow.db"
    send_alert "数据库文件丢失: $DATA_DIR/learngrow.db" "danger"
else
    DB_SIZE=$(du -h "$DATA_DIR/learngrow.db" | cut -f1)
    log_info "✓ 数据库文件存在 ($DB_SIZE)"
fi

# 3. 检查数据完整性
log_info "检查数据完整性..."
if command -v node > /dev/null 2>&1; then
    STATS=$(node -e "
        const Database = require('better-sqlite3');
        const db = new Database('$DATA_DIR/learngrow.db');
        try {
            const stats = {
                wxUsers: db.prepare('SELECT COUNT(*) as c FROM wx_users').get().c,
                children: db.prepare('SELECT COUNT(*) as c FROM children').get().c,
                products: db.prepare('SELECT COUNT(*) as c FROM products').get().c
            };
            console.log(JSON.stringify(stats));
        } catch (e) {
            console.error('ERROR:' + e.message);
            process.exit(1);
        }
    " 2>&1) || {
        log_error "✗ 数据库查询失败: $STATS"
        send_alert "数据库查询失败，可能已损坏: $STATS" "danger"
    }

    if [[ "$STATS" != ERROR:* ]]; then
        WX_USERS=$(echo "$STATS" | node -e "process.stdin.on('data', d => console.log(JSON.parse(d).wxUsers))")
        CHILDREN=$(echo "$STATS" | node -e "process.stdin.on('data', d => console.log(JSON.parse(d).children))")

        log_info "✓ 微信用户数: $WX_USERS"
        log_info "✓ 孩子档案数: $CHILDREN"

        # 数据异常检测
        if [ "$WX_USERS" -eq 0 ]; then
            log_error "✗ 微信用户数为 0，数据可能丢失！"
            send_alert "微信用户数为 0，数据可能丢失！请立即检查数据库" "danger"
        elif [ "$WX_USERS" -lt 50 ]; then
            log_warning "⚠️ 微信用户数异常偏低: $WX_USERS"
            send_alert "微信用户数异常偏低: $WX_USERS（预期 > 50）" "warning"
        fi

        if [ "$CHILDREN" -eq 0 ]; then
            log_error "✗ 孩子档案数为 0，数据可能丢失！"
            send_alert "孩子档案数为 0，数据可能丢失！" "danger"
        fi
    fi
fi

# 4. 检查最近备份
log_info "检查备份状态..."
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/db_learngrow_*.db 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    log_error "✗ 没有任何备份文件！"
    send_alert "没有任何备份文件，请立即手动创建备份" "danger"
else
    BACKUP_TIME=$(stat -c %Y "$LATEST_BACKUP" 2>/dev/null || stat -f %m "$LATEST_BACKUP")
    CURRENT_TIME=$(date +%s)
    HOURS_SINCE_BACKUP=$(( (CURRENT_TIME - BACKUP_TIME) / 3600 ))

    if [ "$HOURS_SINCE_BACKUP" -gt 48 ]; then
        log_error "✗ 最新备份超过 48 小时: $(basename "$LATEST_BACKUP")"
        send_alert "最新备份超过 48 小时（${HOURS_SINCE_BACKUP}小时前），请检查自动备份是否正常运行" "warning"
    elif [ "$HOURS_SINCE_BACKUP" -gt 24 ]; then
        log_warning "⚠️ 最新备份超过 24 小时: $(basename "$LATEST_BACKUP")"
    else
        log_info "✓ 最新备份: $(basename "$LATEST_BACKUP") (${HOURS_SINCE_BACKUP}小时前)"
    fi
fi

# 5. 检查磁盘空间
log_info "检查磁盘空间..."
DISK_USAGE=$(df -h "$DEPLOY_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    log_error "✗ 磁盘使用率过高: ${DISK_USAGE}%"
    send_alert "磁盘使用率过高: ${DISK_USAGE}%，请清理旧备份或扩容" "danger"
elif [ "$DISK_USAGE" -gt 80 ]; then
    log_warning "⚠️ 磁盘使用率偏高: ${DISK_USAGE}%"
else
    log_info "✓ 磁盘使用率: ${DISK_USAGE}%"
fi

# 6. 检查 PM2 进程
log_info "检查 PM2 进程..."
PM2_STATUS=$(pm2 jstatus 2>/dev/null | node -e "
    process.stdin.on('data', d => {
        const apps = JSON.parse(d);
        const app = apps.find(a => a.name === 'learngrow-crm');
        if (app) {
            console.log(app.status);
        } else {
            console.log('NOT_FOUND');
        }
    });
" 2>/dev/null || echo "UNKNOWN")

if [ "$PM2_STATUS" = "online" ]; then
    log_info "✓ PM2 进程状态: $PM2_STATUS"
elif [ "$PM2_STATUS" = "NOT_FOUND" ]; then
    log_error "✗ PM2 中找不到 learngrow-crm 进程"
    send_alert "PM2 中找不到 learngrow-crm 进程，服务可能未启动" "danger"
else
    log_warning "⚠️ PM2 进程状态: $PM2_STATUS"
fi

# 总结
echo ""
echo "========================================="
if [ ${#ERRORS[@]} -eq 0 ] && [ ${#WARNINGS[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ 所有检查项通过${NC}"
else
    if [ ${#ERRORS[@]} -gt 0 ]; then
        echo -e "${RED}✗ 发现 ${#ERRORS[@]} 个错误${NC}"
        for err in "${ERRORS[@]}"; do
            echo "  - $err"
        done
    fi
    if [ ${#WARNINGS[@]} -gt 0 ]; then
        echo -e "${YELLOW}⚠️  发现 ${#WARNINGS[@]} 个警告${NC}"
        for warn in "${WARNINGS[@]}"; do
            echo "  - $warn"
        done
    fi
fi
echo "========================================="

# 如果有错误，退出码为 1
if [ ${#ERRORS[@]} -gt 0 ]; then
    exit 1
fi
