---
name: 版本发布跟踪
about: 用于跟踪某个版本的完整发布流程
title: '[Release] v{VERSION} - {THEME}'
labels: release
assignees: ''
---

## 版本信息
- **版本号**: v{VERSION}
- **主题**: {THEME}
- **计划发版日期**: {DATE}
- **负责人**: @{OWNER}

## 需求清单

### 核心功能
- [ ] 功能点1 (#issue_number)
- [ ] 功能点2 (#issue_number)

### 技术债务
- [ ] 重构任务1 (#issue_number)

### 文档更新
- [ ] 更新CHANGELOG.md
- [ ] 更新API文档
- [ ] 更新用户手册

## 测试验证
- [ ] 单元测试通过率100%
- [ ] 集成测试通过
- [ ] 本地手动回归测试
- [ ] 测试环境部署验证
- [ ] 真机测试(小程序)

## 发版准备
- [ ] 数据库备份完成
- [ ] 迁移脚本测试(如有)
- [ ] 回滚方案准备
- [ ] 通知相关人员

## 发版执行
- [ ] 合并到main分支
- [ ] 打tag: `git tag v{VERSION}`
- [ ] 推送tag: `git push origin v{VERSION}`
- [ ] 触发CI/CD自动部署
- [ ] 健康检查通过

## 发版后
- [ ] 观察错误监控30分钟
- [ ] 验证关键接口正常
- [ ] 收集用户反馈
- [ ] 发送发版通知邮件

## 回滚预案
如出现严重问题，执行回滚:
```bash
git checkout v{PREVIOUS_VERSION}
./scripts/rollback.sh
```

## 备注
{任何需要说明的内容}
