#!/bin/bash
# 原子化部署脚本 - 支持失败回滚和企业微信通知
# 用法: ./scripts/deploy.sh [--rollback] [--dry-run]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 配置变量
DEPLOY_DIR="${DEPLOY_DIR:-/home/ubuntu/learngrow-crm}"
RELEASES_DIR="$DEPLOY_DIR/releases"
BACKUP_DIR="$DEPLOY_DIR/backups"
CURRENT_LINK="$DEPLOY_DIR/current"
LATEST_LINK="$DEPLOY_DIR/latest"
ENV_FILE="$DEPLOY_DIR/.env.production"
WECHAT_WEBHOOK_URL="${WECHAT_WEBHOOK_URL:-}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}LearnGrow CRM 原子化部署工具${NC}"
echo -e "${GREEN}========================================${NC}"

# 解析参数
ROLLBACK=false
DRY_RUN=false

for arg in "$@"; do
    case $arg in
        --rollback)
            ROLLBACK=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            echo -e "${RED}未知参数: $arg${NC}"
            echo "用法: $0 [--rollback] [--dry-run]"
            exit 1
            ;;
    esac
done

# 发送企业微信通知
send_wechat_notification() {
    local status=$1
    local message=$2
    local details=$3
    
    if [ -z "$WECHAT_WEBHOOK_URL" ]; then
        echo -e "${YELLOW}警告: WECHAT_WEBHOOK_URL 未设置，跳过通知${NC}"
        return
    fi
    
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local short_sha=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    
    local color="info"
    local emoji="🚀"
    
    case $status in
        success)
            color="green"
            emoji="✅"
            ;;
        failure)
            color="red"
            emoji="❌"
            ;;
        rollback)
            color="orange"
            emoji="⏪"
            ;;
    esac
    
    curl -s -X POST "$WECHAT_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{
            \"msgtype\": \"markdown\",
            \"markdown\": {
                \"content\": \"$emoji **部署$status**\n\n**环境**: production\n**版本**: \`$short_sha\`\n**时间**: $timestamp\n**详情**: $message\n$details\"
            }
        }" >/dev/null 2>&1 || true
}

# 回滚到上一个版本
rollback_deployment() {
    echo -e "${YELLOW}正在执行回滚...${NC}"
    
    # 查找前一个 release
    PREV_RELEASE=$(ls -t "$RELEASES_DIR" | grep -v "^$(git rev-parse HEAD 2>/dev/null || echo '')$" | head -n 1)
    
    if [ -z "$PREV_RELEASE" ]; then
        echo -e "${RED}错误: 找不到可回滚的版本${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}回滚到版本: $PREV_RELEASE${NC}"
    
    # 切换 symlink
    cd "$DEPLOY_DIR"
    ln -sfn "releases/$PREV_RELEASE" current
    
    # 重启 PM2（尝试 .cjs 和 .js 两种扩展名）
    cd "$CURRENT_LINK"
    if [ -f "ecosystem.config.cjs" ]; then
        pm2 reload ecosystem.config.cjs --env production || pm2 restart all
    else
        pm2 reload ecosystem.config.js --env production || pm2 restart all
    fi
    
    echo -e "${GREEN}回滚成功!${NC}"
    send_wechat_notification "rollback" "已回滚到版本 $PREV_RELEASE" ""
}

# 如果是回滚模式
if [ "$ROLLBACK" = true ]; then
    rollback_deployment
    exit 0
fi

# 预检
echo -e "${BLUE}Step 1/7: 预检...${NC}"

# 检查是否在 git 仓库中
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo -e "${RED}错误: 必须在 git 仓库中运行${NC}"
    exit 1
fi

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}警告: 存在未提交的更改${NC}"
    git status --short
    read -p "是否继续? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}操作已取消${NC}"
        exit 1
    fi
fi

# 确保在 main 分支
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}警告: 当前分支是 $CURRENT_BRANCH，建议在 main 分支部署${NC}"
    read -p "是否继续? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}操作已取消${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ 预检通过${NC}"

# 获取当前 commit
COMMIT_SHA=$(git rev-parse HEAD)
COMMIT_SHORT=$(git rev-parse --short HEAD)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RELEASE_DIR="$RELEASES_DIR/$COMMIT_SHA"

echo -e "${BLUE}Step 2/7: 准备发布目录...${NC}"

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[Dry-run] 将部署到: $RELEASE_DIR${NC}"
else
    mkdir -p "$RELEASES_DIR" "$BACKUP_DIR"
    echo -e "${GREEN}✓ 发布目录: $RELEASE_DIR${NC}"
fi

echo -e "${BLUE}Step 3/7: 备份当前版本和数据库...${NC}"

if [ -L "$CURRENT_LINK" ] && [ -d "$CURRENT_LINK" ]; then
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[Dry-run] 将备份当前版本和数据库${NC}"
    else
        # 备份代码版本
        BACKUP_PATH="$BACKUP_DIR/release_$TIMESTAMP"
        cp -r "$CURRENT_LINK" "$BACKUP_PATH"
        echo -e "${GREEN}✓ 代码备份完成: $BACKUP_PATH${NC}"
        
        # 备份数据库（关键！）
        if [ -f "$DEPLOY_DIR/data/learngrow.db" ]; then
            DB_BACKUP="$BACKUP_DIR/db_learngrow_$TIMESTAMP.db"
            cp "$DEPLOY_DIR/data/learngrow.db" "$DB_BACKUP"
            
            # 验证备份完整性
            if node -e "const Database = require('better-sqlite3'); new Database('$DB_BACKUP').prepare('SELECT 1').get();" 2>/dev/null; then
                echo -e "${GREEN}✓ 数据库备份完成: $DB_BACKUP${NC}"
                
                # 记录备份数据统计
                echo "--- 备份数据统计 ---"
                node -e "
                    const Database = require('better-sqlite3');
                    const db = new Database('$DB_BACKUP');
                    console.log('微信用户:', db.prepare('SELECT COUNT(*) as c FROM wx_users').get().c);
                    console.log('孩子档案:', db.prepare('SELECT COUNT(*) as c FROM children').get().c);
                    console.log('订单数:', db.prepare('SELECT COUNT(*) as c FROM orders').get().c);
                " || true
            else
                echo -e "${RED}✗ 数据库备份损坏，中止部署！${NC}"
                exit 1
            fi
        else
            echo -e "${YELLOW}警告: 未找到现有数据库，跳过数据库备份${NC}"
        fi
    fi
else
    echo -e "${YELLOW}首次部署，无需备份${NC}"
fi

echo -e "${BLUE}Step 4/7: 同步代码到发布目录...${NC}"

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[Dry-run] 将同步代码到 $RELEASE_DIR${NC}"
else
    mkdir -p "$RELEASE_DIR"
    rsync -av --exclude='node_modules' --exclude='.git' --exclude='data' --exclude='.env*' --exclude='backups' --exclude='releases' ./ "$RELEASE_DIR/"
    echo -e "${GREEN}✓ 代码同步完成${NC}"
fi

echo -e "${BLUE}Step 5/7: 安装依赖并构建...${NC}"

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[Dry-run] 将执行 npm ci 和构建${NC}"
else
    cd "$RELEASE_DIR"
    
    # 复制环境文件
    if [ -f "$ENV_FILE" ]; then
        cp "$ENV_FILE" "$RELEASE_DIR/.env.production"
        echo "✓ 环境文件已复制"
    fi
    
    # 创建独立数据目录（如果不存在）
    mkdir -p "$DEPLOY_DIR/data"
    
    # 安装生产依赖
    echo "安装依赖..."
    npm ci --omit=dev
    
    # 运行数据库迁移（使用独立数据目录）
    echo "运行数据库迁移..."
    NODE_ENV=production DATA_DIR="$DEPLOY_DIR/data" npx drizzle-kit migrate --config=drizzle.config.ts
    
    # 构建前端
    echo "构建前端..."
    npm run build
    
    echo -e "${GREEN}✓ 依赖安装和构建完成${NC}"
fi

echo -e "${BLUE}Step 6/7: 原子化切换...${NC}"

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[Dry-run] 将切换 symlink${NC}"
else
    cd "$DEPLOY_DIR"
    
    # 原子化切换: 先创建新的 symlink，再移动
    ln -sfn "$RELEASE_DIR" "current.tmp"
    mv -Tf "current.tmp" "current"
    
    # 更新 latest 链接
    ln -sfn "$RELEASE_DIR" "latest"
    
    echo -e "${GREEN}✓ 已切换到新版本: $COMMIT_SHORT${NC}"
fi

echo -e "${BLUE}Step 7/7: 重启服务并健康检查...${NC}"

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[Dry-run] 将重启 PM2 并执行健康检查${NC}"
else
    cd "$CURRENT_LINK"
    
    # 重载 PM2（尝试 .cjs 和 .js 两种扩展名）
    echo "重载 PM2 服务..."
    if [ -f "ecosystem.config.cjs" ]; then
        pm2 reload ecosystem.config.cjs --env production || pm2 start ecosystem.config.cjs --env production
    else
        pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
    fi
    
    # 等待服务启动
    echo "等待服务启动..."
    sleep 10
    
    # 健康检查
    echo "执行健康检查..."
    MAX_RETRIES=5
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -f http://localhost:3456/api/health >/dev/null 2>&1; then
            echo -e "${GREEN}✓ 健康检查通过${NC}"
            break
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
            echo -e "${RED}✗ 健康检查失败${NC}"
            echo "尝试自动回滚..."
            rollback_deployment
            send_wechat_notification "failure" "健康检查失败，已自动回滚" ""
            exit 1
        fi
        
        echo "健康检查尝试 $RETRY_COUNT/$MAX_RETRIES，5秒后重试..."
        sleep 5
    done
    
    # 数据完整性验证（关键！）
    echo -e "${BLUE}验证数据完整性...${NC}"
    node -e "
        const Database = require('better-sqlite3');
        const db = new Database('$DEPLOY_DIR/data/learngrow.db');
        const stats = {
            wxUsers: db.prepare('SELECT COUNT(*) as c FROM wx_users').get().c,
            children: db.prepare('SELECT COUNT(*) as c FROM children').get().c,
            orders: db.prepare('SELECT COUNT(*) as c FROM orders').get().c,
            products: db.prepare('SELECT COUNT(*) as c FROM products').get().c
        };
        console.log('=== 部署后数据统计 ===');
        console.log('微信用户:', stats.wxUsers);
        console.log('孩子档案:', stats.children);
        console.log('订单数:', stats.orders);
        console.log('产品数:', stats.products);
        
        // 如果关键数据为0，发出警告
        if (stats.wxUsers === 0) {
            console.error('⚠️  警告: 微信用户数为0，可能存在数据问题！');
            process.exit(1);
        }
    " || {
        echo -e "${RED}✗ 数据验证失败，建议检查数据库！${NC}"
        send_wechat_notification "failure" "部署成功但数据验证异常" "请手动检查数据库完整性"
    }
fi

# 清理旧版本
echo -e "${BLUE}清理旧版本...${NC}"

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[Dry-run] 将保留最近 3 个版本${NC}"
else
    cd "$RELEASES_DIR"
    KEEP_COUNT=3
    TOTAL=$(ls -1 | wc -l)
    
    if [ "$TOTAL" -gt "$KEEP_COUNT" ]; then
        ls -t | tail -n +$((KEEP_COUNT + 1)) | xargs rm -rf
        echo -e "${GREEN}✓ 已清理旧版本，保留最近 $KEEP_COUNT 个${NC}"
    else
        echo "当前有 $TOTAL 个版本，无需清理"
    fi
fi

# 部署成功
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}部署成功!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "版本: $COMMIT_SHORT"
echo "目录: $RELEASE_DIR"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

send_wechat_notification "success" "部署成功" "**提交**: \`$COMMIT_SHORT\`"

echo -e "${GREEN}部署完成!${NC}"
