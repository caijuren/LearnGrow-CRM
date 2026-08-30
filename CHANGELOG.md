# 更新日志

本项目采用[语义化版本](https://semver.org/lang/zh-CN/)规范。

---

## [待发布] v2.7.0 - 安全合规加固
**计划发布日期:** 2026-09-07  
**优先级:** 🔴 P0 (阻塞商业化)

### 新增
- ✨ 用户数据删除接口 (`DELETE /api/wx-users/:id`)
  - 支持软删除（标记deleted_at）和硬删除（物理清除）
  - 级联清理9个关联表的数据
  - 自动记录审计日志
- ✨ 批量删除功能 (`POST /api/wx-users/batch-delete`)
- ✨ 过期数据清理功能 (`POST /api/wx-users/purge-expired`)
- ✨ 小程序隐私政策页面更新（符合《个人信息保护法》）
- ✨ 备份文件AES256加密功能
  - 自动加密新生成的备份
  - 解密工具 (`scripts/decrypt-backup.ts`)
- ✨ 密钥轮换脚本 (`scripts/rotate-keys.ts`)

### 改进
- ♻️ 为9个数据库表添加deleted_at字段和索引
- ♻️ 增强审计日志系统
- ♻️ 优化备份服务，支持加密选项

### 修复
- 🐛 修复备份文件未加密的安全隐患
- 🐛 修复用户删除时关联数据残留问题

### 文档
- 📝 新增隐私政策文档 (`docs/PRIVACY_POLICY.md`)
- 📝 新增备份加密指南 (`docs/BACKUP_ENCRYPTION.md`)
- 📝 新增密钥轮换指南 (`docs/KEY_ROTATION.md`)
- 📝 更新环境变量说明 (`.env.example`)

**完整对比:** [v2.6.0...v2.7.0](https://github.com/caijuren/LearnGrow-CRM/compare/v2.6.0...v2.7.0)

---

## [待发布] v2.8.0 - API文档与测试补充
**计划发布日期:** 2026-09-14  
**优先级:** 🔴 P0

### 新增
- ✨ OpenAPI交互式文档 (`/api-docs`)
- ✨ 核心流程集成测试套件

### 改进
- ♻️ README完善，增加开发指南
- ♻️ 错误码文档标准化

### 文档
- 📝 新增API接口详细说明
- 📝 新增贡献者指南

**完整对比:** [v2.7.0...v2.8.0](https://github.com/caijuren/LearnGrow-CRM/compare/v2.7.0...v2.8.0)

---

## [待发布] v2.9.0 - 架构模块化重构
**计划发布日期:** 2026-09-30  
**优先级:** 🟡 P1

### 重构
- 💎 拆分 `api/app.ts` 为路由/服务/仓储三层架构
- 💎 开启TypeScript严格模式

### 改进
- ♻️ 代码组织更清晰，单文件<500行
- ♻️ 提升可维护性和团队协作效率

### 文档
- 📝 新增架构设计说明文档

**完整对比:** [v2.8.0...v2.9.0](https://github.com/caijuren/LearnGrow-CRM/compare/v2.8.0...v2.9.0)

---

## [待发布] v3.0.0 - 数据库迁移系统
**计划发布日期:** 2026-10-07  
**优先级:** 🟡 P1

### 新增
- ✨ Drizzle Kit迁移系统集成
- ✨ 历史schema迁移脚本生成

### 改进
- ♻️ schema变更可追溯，降低数据丢失风险
- ♻️ 支持迁移回滚机制

### 文档
- 📝 新增迁移操作指南

**破坏性变更:** 无（向后兼容）

**完整对比:** [v2.9.0...v3.0.0](https://github.com/caijuren/LearnGrow-CRM/compare/v2.9.0...v3.0.0)

---

## v2.6.0 - 管理端全面优化
**发布日期:** 2026-08-29

### 新增
- ✨ Dashboard重新设计，聚焦微信用户+打卡核心指标
- ✨ 微信用户列表表格化展示
- ✨ 打卡审核增强功能

### 改进
- ♻️ UI视觉规范统一
- ♻️ 性能优化

### 修复
- 🐛 修复头像显示问题
- 🐛 修复排行榜统计错误

**完整对比:** [v2.5.0...v2.6.0](https://github.com/caijuren/LearnGrow-CRM/compare/v2.5.0...v2.6.0)

---

## v2.5.0 - 备份媒体校验与头像/排行榜修复
**发布日期:** 2026-08-20

### 新增
- ✨ 备份后媒体文件完整性校验
- ✨ 恢复后备份体检功能

### 修复
- 🐛 修复头像首字母兜底逻辑
- 🐛 修复排行榜统计不准确问题

**完整对比:** [v2.4.0...v2.5.0](https://github.com/caijuren/LearnGrow-CRM/compare/v2.4.0...v2.5.0)

---

## 版本发布流程

1. **创建Release Issue**: 使用[版本发布跟踪模板](.github/ISSUE_TEMPLATE/version_release.md)
2. **完成所有需求**: 勾选清单中的所有任务
3. **打tag**: `git tag v{VERSION}` && `git push origin v{VERSION}`
4. **自动触发CI/CD**: GitHub Actions自动部署
5. **验证上线**: 健康检查 + 冒烟测试
6. **更新本文档**: 将"待发布"改为正式发布

---

**格式说明:**
- ✨ 新增功能
- 🐛 Bug修复
- ♻️ 改进优化
- 💎 重构
- 📝 文档更新
- ⚠️ 破坏性变更
