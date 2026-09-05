#!/bin/bash
# LearnGrow CRM 原子化部署脚本（在本地开发机执行，通过 SSH 部署到生产服务器）
#
# 用法:
#   ./scripts/deploy.sh              部署当前 HEAD
#   ./scripts/deploy.sh --dry-run    只做预检，不实际部署
#   ./scripts/deploy.sh --rollback   回滚到上一个 release
#
# 环境变量:
#   DEPLOY_SSH   生产服务器（默认 ubuntu@124.220.103.120）
#   DEPLOY_DIR   服务器部署根目录（默认 /home/ubuntu/learngrow-crm）
#   WECHAT_WEBHOOK_URL  部署结果企业微信通知（可选）

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DEPLOY_SSH="${DEPLOY_SSH:-ubuntu@124.220.103.120}"
DEPLOY_DIR="${DEPLOY_DIR:-/home/ubuntu/learngrow-crm}"
RELEASES_DIR="$DEPLOY_DIR/releases"
BACKUP_DIR="$DEPLOY_DIR/backups"
HEALTH_URL="http://127.0.0.1:3456/api/health"
KEEP_RELEASES=3

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}$*${NC}"; }
ok()    { echo -e "${GREEN}✓ $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠ $*${NC}"; }
fail()  { echo -e "${RED}✗ $*${NC}"; exit 1; }

# 远程执行：从 stdin 读取脚本（本地变量已展开，需要保留给远程展开的 $ 请写成 \$）
run_remote() {
  ssh -o BatchMode=yes "$DEPLOY_SSH" 'bash -ls'
}

send_wechat_notification() {
  local emoji=$1 title=$2 details=$3
  [ -z "${WECHAT_WEBHOOK_URL:-}" ] && return 0
  local ts short_sha
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  short_sha=$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)
  curl -s -X POST "$WECHAT_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"msgtype\":\"markdown\",\"markdown\":{\"content\":\"$emoji **$title**\n\n**版本**: \`$short_sha\`\n**时间**: $ts\n$details\"}}" \
    >/dev/null 2>&1 || true
}

# ---------- 参数解析 ----------
ROLLBACK=false
DRY_RUN=false
for arg in "$@"; do
  case $arg in
    --rollback) ROLLBACK=true ;;
    --dry-run)  DRY_RUN=true ;;
    *) echo "用法: $0 [--rollback] [--dry-run]"; exit 1 ;;
  esac
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}LearnGrow CRM 部署工具 (本地执行 → $DEPLOY_SSH)${NC}"
echo -e "${GREEN}========================================${NC}"

# ---------- 回滚 ----------
if [ "$ROLLBACK" = true ]; then
  info "查找可回滚版本..."
  CURRENT_NAME=$(run_remote <<EOF
readlink -f $DEPLOY_DIR/current 2>/dev/null | xargs -r basename || true
EOF
)
  PREV=$(run_remote <<EOF
ls -1t $RELEASES_DIR | grep -vxF "$CURRENT_NAME" | head -1
EOF
)
  [ -n "$PREV" ] || fail "找不到可回滚的版本"
  info "回滚到: $PREV"
  run_remote <<EOF
set -e
cd $DEPLOY_DIR
ln -sfn $RELEASES_DIR/$PREV current.tmp
mv -Tf current.tmp current
ln -sfn $RELEASES_DIR/$PREV latest
cd $DEPLOY_DIR/current
pm2 delete learngrow-crm >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs
pm2 save
EOF
  sleep 8
  if run_remote <<< "curl -fsS $HEALTH_URL" >/dev/null 2>&1; then
    ok "回滚成功，健康检查通过"
    send_wechat_notification "⏪" "部署已回滚" "**回滚到**: \`$PREV\`"
  else
    fail "回滚后健康检查仍失败，请立即人工介入！"
  fi
  exit 0
fi

# ---------- Step 1: 预检 ----------
info "Step 1/7: 预检"
cd "$PROJECT_ROOT"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "必须在 git 仓库中运行"

CURRENT_BRANCH=$(git branch --show-current)
[ "$CURRENT_BRANCH" = "main" ] || warn "当前分支是 $CURRENT_BRANCH（非 main）"

if [ -n "$(git status --porcelain)" ]; then
  warn "存在未提交的更改，将部署包含这些更改的代码："
  git status --short | head -20
fi

COMMIT_SHA=$(git rev-parse HEAD)
COMMIT_SHORT=$(git rev-parse --short HEAD)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RELEASE_DIR="$RELEASES_DIR/$COMMIT_SHA"
info "本次部署版本: $COMMIT_SHORT ($COMMIT_SHA)"

ssh -o BatchMode=yes -o ConnectTimeout=10 "$DEPLOY_SSH" "echo connected" >/dev/null 2>&1 \
  || fail "无法 SSH 连接 $DEPLOY_SSH（请检查网络/密钥）"
ok "SSH 连接正常"

DISK_USAGE=$(run_remote <<EOF
df --output=pcent $DEPLOY_DIR | tail -1 | tr -dc '0-9'
EOF
)
[ "${DISK_USAGE:-0}" -lt 90 ] || fail "服务器磁盘使用率 ${DISK_USAGE}% ≥ 90%，请先清理磁盘"
ok "服务器磁盘使用率 ${DISK_USAGE}%"

if [ "$DRY_RUN" = true ]; then
  ok "[Dry-run] 预检通过，未执行任何变更"
  exit 0
fi

# ---------- Step 2: 备份数据库 ----------
info "Step 2/7: 备份当前数据库"
run_remote <<EOF
mkdir -p $BACKUP_DIR $DEPLOY_DIR/data $RELEASES_DIR
EOF
if run_remote <<< "[ -f $DEPLOY_DIR/data/learngrow.db ]"; then
  DB_BACKUP="$BACKUP_DIR/db_pre_deploy_$TIMESTAMP.db"
  run_remote <<EOF || run_remote <<< "cp $DEPLOY_DIR/data/learngrow.db $DB_BACKUP"
sqlite3 $DEPLOY_DIR/data/learngrow.db ".backup '$DB_BACKUP'"
EOF
  run_remote <<EOF >/dev/null || fail "数据库备份完整性校验失败，中止部署"
cd $DEPLOY_DIR/current && node -e "const db=require('better-sqlite3')('$DB_BACKUP',{readonly:true});db.prepare('PRAGMA integrity_check').get();console.log('backup-ok')"
EOF
  ok "数据库备份完成: $DB_BACKUP"
else
  warn "未找到现有数据库，跳过备份（首次部署）"
fi

# ---------- Step 3: 同步代码 ----------
info "Step 3/7: 同步代码到 $RELEASE_DIR"
run_remote <<< "mkdir -p $RELEASE_DIR $DEPLOY_DIR/uploads"
rsync -az --delete \
  --exclude='node_modules' --exclude='.git' --exclude='data' \
  --exclude='.env' --exclude='.env.*' \
  --exclude='backups' --exclude='releases' \
  --exclude='miniprogram' --exclude='uploads' \
  --exclude='*.zip' --exclude='docs' \
  -e "ssh -o BatchMode=yes" \
  "$PROJECT_ROOT/" "$DEPLOY_SSH:$RELEASE_DIR/"
# uploads 独立于 release 目录，软链到共享目录，发版永不覆盖
run_remote <<< "ln -sfn $DEPLOY_DIR/uploads $RELEASE_DIR/uploads"
ok "代码同步完成（已排除 miniprogram / .env / data / uploads）"

# ---------- Step 4: 安装依赖 + 构建 ----------
info "Step 4/7: 远程安装依赖、构建前端（耗时数分钟）"
run_remote <<EOF
set -e
cd $RELEASE_DIR
# 中央环境文件软链进 release（不存在则依赖 ecosystem 的多路径合并逻辑）
if [ -f $DEPLOY_DIR/.env.production ]; then ln -sfn $DEPLOY_DIR/.env.production .env.production; fi
echo '=== npm ci ==='
npm ci --no-audit --no-fund
echo '=== build ==='
npm run build
EOF
ok "依赖安装、前端构建完成"

# ---------- Step 5: 原子切换 ----------
info "Step 5/7: 原子切换 symlink"
PREV_RELEASE=$(run_remote <<< "readlink -f $DEPLOY_DIR/current 2>/dev/null || true")
run_remote <<EOF
set -e
cd $DEPLOY_DIR
ln -sfn $RELEASE_DIR current.tmp
mv -Tf current.tmp current
ln -sfn $RELEASE_DIR latest
EOF
ok "current → $COMMIT_SHORT"

# ---------- Step 6: 重启服务 + 健康检查 ----------
info "Step 6/7: 重启 PM2 并健康检查"
run_remote <<EOF
cd $DEPLOY_DIR/current
pm2 delete learngrow-crm >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs
pm2 save
EOF

HEALTH_OK=false
for i in $(seq 1 12); do
  sleep 5
  if run_remote <<< "curl -fsS $HEALTH_URL" | grep -q '"success"'; then
    HEALTH_OK=true
    break
  fi
  warn "健康检查 $i/12 未通过，5秒后重试"
  if run_remote <<< "pm2 jlist" | grep -q '"status":"errored"'; then
    warn "PM2 进程已报错，提前结束等待"
    break
  fi
done

if [ "$HEALTH_OK" != true ]; then
  warn "健康检查失败，最近错误日志："
  run_remote <<< "pm2 logs learngrow-crm --err --nostream --lines 30" || true
  if [ -n "$PREV_RELEASE" ]; then
    info "自动回滚到上一版本: $PREV_RELEASE"
    run_remote <<EOF
set -e
cd $DEPLOY_DIR
ln -sfn $PREV_RELEASE current.tmp
mv -Tf current.tmp current
ln -sfn $PREV_RELEASE latest
cd $DEPLOY_DIR/current
pm2 delete learngrow-crm >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs
pm2 save
EOF
    sleep 8
    if run_remote <<< "curl -fsS $HEALTH_URL" >/dev/null 2>&1; then
      ok "已回滚，服务恢复正常"
    else
      warn "回滚后健康检查仍未通过，请立即人工介入！"
    fi
  else
    warn "无上一版本可回滚，请人工介入！"
  fi
  send_wechat_notification "❌" "部署失败已自动回滚" "**失败版本**: \`$COMMIT_SHORT\`"
  fail "部署失败（健康检查未通过）"
fi
ok "健康检查通过"

# ---------- Step 7: 部署后验证 + 清理 ----------
info "Step 7/7: 部署后验证与清理"
UPLOAD_COUNT=$(run_remote <<< "find -L $DEPLOY_DIR/current/uploads -type f 2>/dev/null | wc -l")
if [ "${UPLOAD_COUNT:-0}" -gt 0 ]; then
  ok "uploads 完整（$UPLOAD_COUNT 个文件）"
else
  warn "uploads 为空或软链失效，请立即检查 $DEPLOY_DIR/uploads！"
fi
run_remote <<< "curl -fsS http://127.0.0.1:3456/api/version" || true
echo
run_remote <<EOF || warn "数据完整性检查失败（不影响部署结果，请人工确认）"
cd $DEPLOY_DIR/current && node -e "
const db = require('better-sqlite3')('$DEPLOY_DIR/data/learngrow.db', {readonly:true});
const t = (n) => { try { return db.prepare('SELECT COUNT(*) c FROM ' + n).get().c; } catch(e) { return 'N/A'; } };
const c = () => { try { return db.prepare(\"SELECT COUNT(*) c FROM wx_users WHERE child_name IS NOT NULL AND child_name != ''\").get().c; } catch(e) { return 'N/A'; } };
console.log('=== 数据完整性 ===');
console.log('微信用户:', t('wx_users'), '| 已设孩子名:', c(), '| 订单:', t('orders'), '| 产品:', t('products'));
"
EOF

# 清理旧版本：保留最近 KEEP_RELEASES 个，但永不删除 current 指向的版本
run_remote <<EOF
cd $RELEASES_DIR
CUR=\$(readlink -f $DEPLOY_DIR/current | xargs basename)
ls -1t | grep -v "\$CUR" | tail -n +$KEEP_RELEASES | xargs -r rm -rf
EOF
ok "旧版本清理完成（保留最近 $KEEP_RELEASES 个，current 永不删除）"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}部署成功!${NC}"
echo -e "${GREEN}========================================${NC}"
echo "版本: $COMMIT_SHORT"
echo "目录: $RELEASE_DIR"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
send_wechat_notification "✅" "部署成功" "**版本**: \`$COMMIT_SHORT\`"
