#!/bin/bash
# ============================================
# v2.7.0 快速启动脚本
# ============================================
# 用途: 一键初始化v2.7.0版本所需的环境和工具
# 用法: bash scripts/start-v2.7.0.sh
# ============================================

set -e  # 遇到错误立即退出

echo "🚀 开始初始化 v2.7.0 - 安全合规加固"
echo ""

# 1. 检查Node.js版本
echo "📦 检查Node.js环境..."
NODE_VERSION=$(node --version)
echo "   当前版本: $NODE_VERSION"
if [[ ! "$NODE_VERSION" =~ ^v2[0-9] ]]; then
  echo "⚠️  警告: 建议使用Node.js v20+"
fi

# 2. 安装依赖
echo ""
echo "📥 安装项目依赖..."
npm ci
echo "✅ 依赖安装完成"

# 3. 生成新密钥
echo ""
echo "🔑 生成新的JWT_SECRET..."
NEW_JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
echo "   新密钥: $NEW_JWT_SECRET"
echo ""
echo "⚠️  重要: 请复制上面的密钥并安全保存！"
echo "   不要提交到git，通过安全渠道传递给团队成员"
read -p "按回车键继续..."

# 4. 检查git历史是否有.env泄露
echo ""
echo "🔍 检查git历史中的敏感文件..."
ENV_IN_GIT=$(git log --all --full-history -- .env .env.production 2>/dev/null | wc -l)
if [ "$ENV_IN_GIT" -gt 0 ]; then
  echo "⚠️  警告: 发现.env文件曾提交到git历史！"
  echo "   建议在v2.7.0中执行git历史清理"
  read -p "是否查看详细信息? (y/n): " SHOW_DETAILS
  if [ "$SHOW_DETAILS" = "y" ]; then
    git log --all --full-history -- .env .env.production
  fi
else
  echo "✅ 未发现.env文件在git历史中"
fi

# 5. 创建v2.7.0分支
echo ""
echo "🌿 创建v2.7.0开发分支..."
git checkout -b feature/v2.7.0-security
echo "✅ 已切换到 feature/v2.7.0-security 分支"

# 6. 检查环境变量文件
echo ""
echo "📝 检查环境变量配置..."
if [ ! -f ".env" ]; then
  echo "⚠️  未找到.env文件，从模板创建..."
  cp .env.example .env
  echo "✅ 已创建.env，请填写真实值"
else
  echo "✅ .env文件存在"
fi

if [ ! -f ".env.production" ]; then
  echo "⚠️  未找到.env.production文件"
  echo "   请在部署前基于.env.example创建"
fi

# 7. 运行现有测试
echo ""
echo "🧪 运行现有测试套件..."
npm test || {
  echo "⚠️  测试失败，请先修复现有问题再继续v2.7.0开发"
  exit 1
}
echo "✅ 所有测试通过"

# 8. 显示下一步行动
echo ""
echo "=========================================="
echo "✅ v2.7.0 初始化完成！"
echo "=========================================="
echo ""
echo "📋 下一步行动:"
echo "1. 阅读 docs/v2.7.0-tasks.md 了解详细任务"
echo "2. 在GitHub创建以下Issue:"
echo "   - #1 密钥轮换与安全检查"
echo "   - #2 隐私政策页面实现"
echo "   - #3 用户数据删除接口"
echo "   - #4 备份加密实现"
echo "   - #5 文档更新"
echo ""
echo "3. 开始执行 Issue #1 (密钥轮换)"
echo ""
echo "📖 相关文档:"
echo "   - ROADMAP.md - 完整迭代计划"
echo "   - CHANGELOG.md - 版本更新日志"
echo "   - docs/v2.7.0-tasks.md - v2.7.0详细任务分解"
echo ""
echo "祝开发顺利！🎉"
