#!/bin/bash
# 自动化数据库备份脚本 - 每日执行
# 用法: ./scripts/auto-backup.sh [--upload-cos]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 配置变量
DEPLOY_DIR="${DEPLOY_DIR:-$HOME/learngrow-crm}"
DATA_DIR="$DEPLOY_DIR/data"
BACKUP_DIR="$DEPLOY_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_TODAY=$(date +%Y-%m-%d)

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}LearnGrow CRM 自动化数据库备份${NC}"
echo -e "${GREEN}时间: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${GREEN}========================================${NC}"

# 检查数据目录
if [ ! -d "$DATA_DIR" ]; then
    echo -e "${RED}错误: 数据目录不存在: $DATA_DIR${NC}"
    exit 1
fi

if [ ! -f "$DATA_DIR/learngrow.db" ]; then
    echo -e "${RED}错误: 数据库文件不存在${NC}"
    exit 1
fi

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 备份数据库
DB_BACKUP="$BACKUP_DIR/db_learngrow_$TIMESTAMP.db"
echo -e "${BLUE}正在备份数据库...${NC}"
cp "$DATA_DIR/learngrow.db" "$DB_BACKUP"

# 验证备份完整性
echo -e "${BLUE}验证备份完整性...${NC}"
if node -e "const Database = require('better-sqlite3'); const db = new Database('$DB_BACKUP'); console.log('微信用户:', db.prepare('SELECT COUNT(*) as c FROM wx_users').get().c);" 2>/dev/null; then
    BACKUP_SIZE=$(du -h "$DB_BACKUP" | cut -f1)
    echo -e "${GREEN}✓ 数据库备份成功: $DB_BACKUP ($BACKUP_SIZE)${NC}"
else
    echo -e "${RED}✗ 数据库备份损坏，删除无效备份${NC}"
    rm -f "$DB_BACKUP"
    exit 1
fi

# 记录备份元数据
cat > "$BACKUP_DIR/db_learngrow_$TIMESTAMP.meta.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "date": "$DATE_TODAY",
  "size": $(stat -f%z "$DB_BACKUP" 2>/dev/null || stat -c%s "$DB_BACKUP"),
  "stats": {
    "wxUsers": $(node -e "const Database = require('better-sqlite3'); const db = new Database('$DB_BACKUP'); console.log(db.prepare('SELECT COUNT(*) as c FROM wx_users').get().c);"),
    "children": $(node -e "const Database = require('better-sqlite3'); const db = new Database('$DB_BACKUP'); console.log(db.prepare('SELECT COUNT(*) as c FROM children').get().c);"),
    "orders": $(node -e "const Database = require('better-sqlite3'); const db = new Database('$DB_BACKUP'); console.log(db.prepare('SELECT COUNT(*) as c FROM orders').get().c);"),
    "products": $(node -e "const Database = require('better-sqlite3'); const db = new Database('$DB_BACKUP'); console.log(db.prepare('SELECT COUNT(*) as c FROM products').get().c);")
  }
}
EOF

echo -e "${GREEN}✓ 备份元数据已记录${NC}"

# 清理旧备份（保留策略）
echo -e "${BLUE}清理旧备份...${NC}"
cd "$BACKUP_DIR"

# 保留最近7天的每日备份
find . -name "db_learngrow_*.db" -mtime +7 -delete 2>/dev/null || true

# 保留最近30天的每周备份（周日）
DAY_OF_WEEK=$(date +%u)
if [ "$DAY_OF_WEEK" != "7" ]; then
    find . -name "db_learngrow_*.db" -mtime +30 -daystart -not -weekday 0 -delete 2>/dev/null || true
fi

# 保留最近90天的每月备份（1号）
DAY_OF_MONTH=$(date +%d)
if [ "$DAY_OF_MONTH" != "01" ]; then
    find . -name "db_learngrow_*.db" -mtime +90 -daystart -not -day 1 -delete 2>/dev/null || true
fi

REMAINING_BACKUPS=$(ls -1 db_learngrow_*.db 2>/dev/null | wc -l)
echo -e "${GREEN}✓ 当前保留备份数: $REMAINING_BACKUPS${NC}"

# 可选：上传到腾讯云 COS
if [[ "${1:-}" == "--upload-cos" ]]; then
    if command -v coscmd >/dev/null 2>&1; then
        echo -e "${BLUE}上传备份到腾讯云 COS...${NC}"
        coscmd upload "$DB_BACKUP" "/backups/db_learngrow_$TIMESTAMP.db" || {
            echo -e "${YELLOW}警告: COS 上传失败，但本地备份已成功${NC}"
        }
    else
        echo -e "${YELLOW}警告: coscmd 未安装，跳过 COS 上传${NC}"
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}备份完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo "备份文件: $DB_BACKUP"
echo "备份时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "保留策略: 7天每日 + 30天每周 + 90天每月"
echo ""
