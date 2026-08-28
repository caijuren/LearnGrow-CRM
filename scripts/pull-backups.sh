#!/usr/bin/env bash
# 把服务器上的完整备份拉回本机一份异地副本。
#
# 为什么需要：备份 zip 原本只存在跑业务的那台机器上（且只保留最近若干份），
# 2026-08-27 那次媒体丢失就差一步变成全损——机器被重置/误删项目目录时，数据和备份会一起没。
#
# 用法：
#   npm run backup:pull                    # 拉取 + 校验 + 清理过期
#   npm run backup:pull:install            # 装成每天自动跑（macOS LaunchAgent，09:30 与 21:30）
#   npm run backup:pull:uninstall          # 卸载定时任务
#
# 落盘位置在仓库之外：备份里含家长手机号与孩子姓名，不要混进 git 工作区。
set -euo pipefail

SERVER="${LEARNGROW_BACKUP_SERVER:-ubuntu@124.220.103.120}"
REMOTE_DIR="${LEARNGROW_BACKUP_REMOTE_DIR:-/var/www/learngrow-crm/backups}"
LOCAL_DIR="${LEARNGROW_BACKUP_LOCAL_DIR:-$HOME/LearnGrow-CRM-backups}"
KEEP_DAYS="${LEARNGROW_BACKUP_KEEP_DAYS:-30}"
LABEL="com.learngrow.backup-pull"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=no)

if [[ "${1:-}" == "--install" ]]; then
  mkdir -p "$HOME/Library/LaunchAgents"
  # macOS 隐私保护不允许 launchd 读 ~/Desktop 下的文件，因此调度仓库外的这份副本
  RUN_DIR="$HOME/Library/Application Support/learngrow"
  mkdir -p "$RUN_DIR"
  cp "$SCRIPT_PATH" "$RUN_DIR/pull-backups.sh"
  chmod +x "$RUN_DIR/pull-backups.sh"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$RUN_DIR/pull-backups.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Hour</key><integer>21</integer><key>Minute</key><integer>30</integer></dict>
  </array>
  <key>StandardOutPath</key><string>$LOCAL_DIR/launchd.out.log</string>
  <key>StandardErrorPath</key><string>$LOCAL_DIR/launchd.err.log</string>
</dict>
</plist>
EOF
  mkdir -p "$LOCAL_DIR"
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  echo "✅ 已安装每日自动拉取：$PLIST"
  echo "   实际执行副本：$RUN_DIR/pull-backups.sh（改完仓库里的脚本后重跑本命令即可同步）"
  echo "   每天 09:30 与 21:30 各跑一次（错过时点会在下次唤醒时补跑），日志：$LOCAL_DIR/launchd.*.log"
  exit 0
fi

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "✅ 已卸载定时拉取"
  exit 0
fi

mkdir -p "$LOCAL_DIR"
chmod 700 "$LOCAL_DIR"

echo "📥 从 $SERVER:$REMOTE_DIR 拉取备份到 $LOCAL_DIR"
before=$(find "$LOCAL_DIR" -maxdepth 1 -name 'backup_*.zip' | wc -l | tr -d ' ')
rsync -a --include='backup_*.zip' --exclude='*' \
  -e "ssh ${SSH_OPTS[*]}" "$SERVER:$REMOTE_DIR/" "$LOCAL_DIR/"
after=$(find "$LOCAL_DIR" -maxdepth 1 -name 'backup_*.zip' | wc -l | tr -d ' ')
echo "   本机现有 $after 份（本次新增 $((after - before)) 份）"

# 每份包都做完整性校验；体检读数只在第一次见到某个包时打印
VERIFIED="$LOCAL_DIR/.verified"
touch "$VERIFIED"
while IFS= read -r name; do
  [[ -z "$name" ]] && continue
  f="$LOCAL_DIR/$name"
  if ! unzip -tqq "$f" >/dev/null 2>&1; then
    echo "❌ 备份包损坏：$f"
    exit 1
  fi
  if ! grep -qxF "$name" "$VERIFIED"; then
    echo "   🔍 $name $(unzip -p "$f" backup-info.json 2>/dev/null | tr -d '\n ' | sed 's/[{}"]//g')"
    echo "$name" >> "$VERIFIED"
  fi
done < <(ls -1 "$LOCAL_DIR" 2>/dev/null | grep -E '^backup_[0-9]{14}\.zip$' | sort)

find "$LOCAL_DIR" -maxdepth 1 -name 'backup_*.zip' -mtime +"$KEEP_DAYS" -print -delete | sed 's/^/🗑  /'
# 体检记录与实际留存的包对齐
while IFS= read -r name; do
  if [[ -f "$LOCAL_DIR/$name" ]]; then printf '%s\n' "$name"; fi
done < "$VERIFIED" > "$VERIFIED.tmp" && mv "$VERIFIED.tmp" "$VERIFIED"

echo "✅ 完成 $(date '+%F %T')"
