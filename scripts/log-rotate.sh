#!/bin/bash
# 日志轮转脚本 - 按天分割、压缩、清理旧日志
# 用法: ./scripts/log-rotate.sh [--dry-run] [--cleanup-only]
# 建议配置 cron: 0 0 * * * /opt/learngrow-crm/current/scripts/log-rotate.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 配置变量
LOG_DIR="${LOG_DIR:-/var/log/learngrow-crm}"
PM2_LOG_DIR="${PM2_LOG_DIR:-$HOME/.pm2/logs}"
NGINX_LOG_DIR="${NGINX_LOG_DIR:-/var/log/nginx}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"  # 保留天数
COMPRESS_AFTER_DAYS="${COMPRESS_AFTER_DAYS:-1}"  # 多少天后压缩

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}LearnGrow CRM 日志轮转工具${NC}"
echo -e "${GREEN}========================================${NC}"

# 解析参数
DRY_RUN=false
CLEANUP_ONLY=false

for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --cleanup-only)
            CLEANUP_ONLY=true
            shift
            ;;
        *)
            echo -e "${RED}未知参数: $arg${NC}"
            echo "用法: $0 [--dry-run] [--cleanup-only]"
            exit 1
            ;;
    esac
done

TODAY=$(date +%Y%m%d)
YESTERDAY=$(date -d "yesterday" +%Y%m%d 2>/dev/null || date -v-1d +%Y%m%d)

echo -e "${BLUE}当前日期: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${BLUE}保留天数: ${RETENTION_DAYS} 天${NC}"
echo ""

# 清理旧日志文件
cleanup_old_logs() {
    local dir=$1
    local label=$2

    if [ ! -d "$dir" ]; then
        echo -e "${YELLOW}目录不存在，跳过: $dir${NC}"
        return
    fi

    echo -e "${BLUE}清理 $label 日志...${NC}"

    # 删除超过保留期的文件
    DELETED_COUNT=0

    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[Dry-run] 将删除以下文件:${NC}"
        find "$dir" -name "*.log.*" -type f -mtime +$RETENTION_DAYS -print 2>/dev/null | head -20
        DELETED_COUNT=$(find "$dir" -name "*.log.*" -type f -mtime +$RETENTION_DAYS 2>/dev/null | wc -l)
        echo -e "${YELLOW}[Dry-run] 预计删除 $DELETED_COUNT 个文件${NC}"
    else
        # 删除旧日志
        while IFS= read -r file; do
            rm -f "$file"
            DELETED_COUNT=$((DELETED_COUNT + 1))
        done < <(find "$dir" -name "*.log.*" -type f -mtime +$RETENTION_DAYS 2>/dev/null)

        echo -e "${GREEN}✓ 已删除 $DELETED_COUNT 个过期日志文件${NC}"
    fi

    # 压缩昨天的日志
    COMPRESSED_COUNT=0
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[Dry-run] 将压缩以下文件:${NC}"
        find "$dir" -name "*.log.$YESTERDAY" -type f -print 2>/dev/null | head -10
        COMPRESSED_COUNT=$(find "$dir" -name "*.log.$YESTERDAY" -type f 2>/dev/null | wc -l)
        echo -e "${YELLOW}[Dry-run] 预计压缩 $COMPRESSED_COUNT 个文件${NC}"
    else
        while IFS= read -r file; do
            gzip -k "$file" 2>/dev/null && rm -f "$file"
            COMPRESSED_COUNT=$((COMPRESSED_COUNT + 1))
        done < <(find "$dir" -name "*.log.$YESTERDAY" -type f 2>/dev/null)

        if [ $COMPRESSED_COUNT -gt 0 ]; then
            echo -e "${GREEN}✓ 已压缩 $COMPRESSED_COUNT 个日志文件${NC}"
        fi
    fi
}

# 轮转 PM2 日志
rotate_pm2_logs() {
    echo -e "${BLUE}轮转 PM2 日志...${NC}"

    if [ ! -d "$PM2_LOG_DIR" ]; then
        echo -e "${YELLOW}PM2 日志目录不存在: $PM2_LOG_DIR${NC}"
        return
    fi

    # 列出所有 PM2 日志文件
    for log_file in "$PM2_LOG_DIR"/*.log; do
        if [ ! -f "$log_file" ]; then
            continue
        fi

        local basename=$(basename "$log_file" .log)
        local rotated_name="${basename}.log.${YESTERDAY}"

        if [ "$DRY_RUN" = true ]; then
            echo -e "${YELLOW}[Dry-run] 将轮转: $log_file -> $rotated_name${NC}"
        else
            # 如果文件存在且不为空
            if [ -s "$log_file" ]; then
                cp "$log_file" "$rotated_name"
                truncate -s 0 "$log_file"
                echo "✓ 轮转: $basename"
            fi
        fi
    done

    # 使用 PM2 内置命令轮转（推荐）
    if command -v pm2 >/dev/null 2>&1; then
        if [ "$DRY_RUN" = false ]; then
            pm2 reloadLogs >/dev/null 2>&1 || true
            echo -e "${GREEN}✓ PM2 日志已轮转${NC}"
        fi
    fi
}

# 轮转 Nginx 日志
rotate_nginx_logs() {
    echo -e "${BLUE}轮转 Nginx 日志...${NC}"

    if [ ! -d "$NGINX_LOG_DIR" ]; then
        echo -e "${YELLOW}Nginx 日志目录不存在: $NGINX_LOG_DIR${NC}"
        return
    fi

    # 检查是否有 Nginx 进程
    if ! pgrep nginx >/dev/null 2>&1; then
        echo -e "${YELLOW}Nginx 未运行，跳过信号发送${NC}"
        return
    fi

    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[Dry-run] 将轮转 Nginx 日志并发送 USR1 信号${NC}"
    else
        # 重命名当前日志文件
        for log_file in "$NGINX_LOG_DIR"/*.log; do
            if [ ! -f "$log_file" ] || [ -L "$log_file" ]; then
                continue
            fi

            local rotated_name="${log_file}.${YESTERDAY}"
            mv "$log_file" "$rotated_name"
            echo "✓ 轮转: $(basename $log_file)"
        done

        # 发送 USR1 信号让 Nginx 重新打开日志文件
        kill -USR1 $(cat /var/run/nginx.pid 2>/dev/null || pgrep -x nginx | head -1) 2>/dev/null || true
        echo -e "${GREEN}✓ Nginx 日志已轮转${NC}"
    fi
}

# 显示磁盘使用情况
show_disk_usage() {
    echo -e "${BLUE}日志目录磁盘使用情况:${NC}"
    echo ""

    for dir in "$LOG_DIR" "$PM2_LOG_DIR" "$NGINX_LOG_DIR"; do
        if [ -d "$dir" ]; then
            local size=$(du -sh "$dir" 2>/dev/null | cut -f1)
            local count=$(find "$dir" -type f 2>/dev/null | wc -l)
            echo -e "  ${GREEN}$dir${NC}: $size ($count 个文件)"
        fi
    done

    echo ""
}

# 主流程
if [ "$CLEANUP_ONLY" = true ]; then
    echo -e "${YELLOW}仅执行清理模式${NC}"
    cleanup_old_logs "$LOG_DIR" "应用日志"
    cleanup_old_logs "$PM2_LOG_DIR" "PM2 日志"
    cleanup_old_logs "$NGINX_LOG_DIR" "Nginx 日志"
else
    # 完整轮转流程
    rotate_pm2_logs
    rotate_nginx_logs

    echo ""
    cleanup_old_logs "$LOG_DIR" "应用日志"
    cleanup_old_logs "$PM2_LOG_DIR" "PM2 日志"
    cleanup_old_logs "$NGINX_LOG_DIR" "Nginx 日志"
fi

echo ""
show_disk_usage

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}日志轮转完成!${NC}"
echo -e "${GREEN}========================================${NC}"

if [ "$DRY_RUN" = true ]; then
    echo ""
    echo -e "${YELLOW}这是 Dry-run 模式，未执行实际操作${NC}"
    echo "移除 --dry-run 参数以执行实际轮转"
fi
