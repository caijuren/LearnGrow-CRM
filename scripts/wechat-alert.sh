#!/bin/bash
# 企业微信告警脚本
# 用法: ./wechat-alert.sh <消息内容> [消息类型]
# 消息类型: danger(危险), warning(警告), info(信息)

set -euo pipefail

# 从环境变量获取 webhook URL，如果没有则退出
WEBHOOK_URL="${WECHAT_WEBHOOK_URL:-}"

if [ -z "$WEBHOOK_URL" ]; then
    echo "错误: WECHAT_WEBHOOK_URL 环境变量未设置"
    exit 1
fi

# 消息内容
MESSAGE="${1:-无消息内容}"
MSG_TYPE="${2:-info}"

# 根据消息类型设置颜色
case $MSG_TYPE in
    danger)
        COLOR="red"
        EMOJI="🚨"
        ;;
    warning)
        COLOR="orange"
        EMOJI="⚠️"
        ;;
    info)
        COLOR="blue"
        EMOJI="ℹ️"
        ;;
    *)
        COLOR="green"
        EMOJI="✅"
        ;;
esac

# 获取服务器信息
HOSTNAME=$(hostname)
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
COMMIT_SHA=$(cd ~/learngrow-crm/current && git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# 发送企业微信消息
curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{
        \"msgtype\": \"markdown\",
        \"markdown\": {
            \"content\": \"${EMOJI} **LearnGrow CRM 告警**\\n\\n**环境**: production\\n**服务器**: ${HOSTNAME}\\n**时间**: ${TIMESTAMP}\\n**版本**: \`${COMMIT_SHA}\`\\n**类型**: ${MSG_TYPE}\\n\\n**详情**: ${MESSAGE}\"
        }
    }" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✓ 企业微信告警已发送"
else
    echo "✗ 企业微信告警发送失败"
    exit 1
fi
