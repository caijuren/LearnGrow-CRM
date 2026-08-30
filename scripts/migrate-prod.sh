#!/bin/bash
# 生产环境数据库迁移脚本
# 用法: ./scripts/migrate-prod.sh [--dry-run] [--revert]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}生产环境数据库迁移工具${NC}"
echo -e "${GREEN}========================================${NC}"

# 检查环境变量
if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${YELLOW}警告: DATABASE_URL 未设置，使用默认路径${NC}"
    export DATABASE_URL="./data/learngrow.db"
fi

# 解析参数
DRY_RUN=false
REVERT=false

for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --revert)
            REVERT=true
            shift
            ;;
        *)
            echo -e "${RED}未知参数: $arg${NC}"
            echo "用法: $0 [--dry-run] [--revert]"
            exit 1
            ;;
    esac
done

# 检查数据库文件
DB_PATH="${DATABASE_URL:-./data/learngrow.db}"
if [[ ! "$DB_PATH" = /* ]]; then
    DB_PATH="$PROJECT_ROOT/$DB_PATH"
fi

if [ ! -f "$DB_PATH" ] && [ "$DRY_RUN" = false ] && [ "$REVERT" = false ]; then
    echo -e "${YELLOW}数据库文件不存在: $DB_PATH${NC}"
    echo -e "${YELLOW}将创建新数据库并应用所有迁移${NC}"
    read -p "确认继续? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}操作已取消${NC}"
        exit 1
    fi
fi

# 备份数据库（仅在非 dry-run 且数据库存在时）
if [ "$DRY_RUN" = false ] && [ "$REVERT" = false ] && [ -f "$DB_PATH" ]; then
    BACKUP_DIR="$PROJECT_ROOT/backups"
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/learngrow_${TIMESTAMP}.db"

    echo -e "${GREEN}正在备份数据库...${NC}"
    cp "$DB_PATH" "$BACKUP_FILE"
    echo -e "${GREEN}备份完成: $BACKUP_FILE${NC}"
fi

# 执行迁移
cd "$PROJECT_ROOT"

if [ "$REVERT" = true ]; then
    echo -e "${YELLOW}正在回滚最后一次迁移...${NC}"
    npx drizzle-kit revert --config=drizzle.config.ts
    echo -e "${GREEN}回滚完成${NC}"
elif [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}Dry-run 模式: 仅生成迁移，不应用${NC}"
    npx drizzle-kit generate --config=drizzle.config.ts
    echo -e "${GREEN}迁移脚本已生成到 migrations/ 目录${NC}"
    echo -e "${YELLOW}请审查后移除 --dry-run 参数正式执行${NC}"
else
    echo -e "${GREEN}正在应用迁移...${NC}"
    npx drizzle-kit migrate --config=drizzle.config.ts
    echo -e "${GREEN}迁移成功完成!${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}操作完成${NC}"
echo -e "${GREEN}========================================${NC}"
