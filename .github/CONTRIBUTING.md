# LearnGrow CRM 贡献指南

欢迎为LearnGrow CRM项目做出贡献！本指南将帮助你了解如何参与项目开发。

---

## 📋 目录

- [代码规范](#代码规范)
- [开发流程](#开发流程)
- [提交流程](#提交流程)
- [测试要求](#测试要求)
- [版本发布](#版本发布)
- [问题报告](#问题报告)

---

## 代码规范

### TypeScript规范

1. **严格模式**: 项目启用 `"strict": true`，禁止使用 `@ts-ignore` 或 `any` 类型
2. **命名约定**:
   - 变量/函数: camelCase (`getUserById`)
   - 类/接口: PascalCase (`UserService`)
   - 常量: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
   - 文件: kebab-case (`user-service.ts`)

3. **导入顺序**:
   ```typescript
   // 1. Node内置模块
   import path from 'path';
   import fs from 'fs';

   // 2. 第三方库
   import Fastify from 'fastify';
   import bcrypt from 'bcryptjs';

   // 3. 内部模块 (按路径层级)
   import { authMiddleware } from '../services/auth.js';
   import db from '../db.js';
   import type { WxUser } from '../../shared/types.js';
   ```

4. **错误处理**:
   ```typescript
   // ✅ 推荐
   try {
     await doSomething();
   } catch (error) {
     app.log.error(error);
     return reply.code(500).send({ success: false, error: '操作失败' });
   }

   // ❌ 避免
   try {
     await doSomething();
   } catch (e) {
     // 空catch块
   }
   ```

### React规范

1. **组件命名**: PascalCase (`WxUserList.tsx`)
2. **Hooks顺序**: 所有hooks在组件顶部声明
3. **Props类型**: 必须明确定义
   ```typescript
   interface UserCardProps {
     user: WxUser;
     onClick: (id: number) => void;
   }

   export function UserCard({ user, onClick }: UserCardProps) {
     // ...
   }
   ```

### SQL规范

1. **参数化查询**: 永远不要拼接SQL字符串
   ```typescript
   // ✅ 正确
   db.prepare('SELECT * FROM wx_users WHERE id = ?').get(userId);

   // ❌ 危险
   db.prepare(`SELECT * FROM wx_users WHERE id = ${userId}`).get();
   ```

2. **事务处理**: 多表操作必须使用事务
   ```typescript
   db.transaction(() => {
     db.prepare('INSERT INTO orders ...').run(...);
     db.prepare('UPDATE wx_users ...').run(...);
   })();
   ```

---

## 开发流程

### 1. 环境搭建

```bash
# 克隆仓库
git clone git@github.com:caijuren/LearnGrow-CRM.git
cd LearnGrow-CRM

# 安装依赖
npm ci

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入真实值

# 启动开发服务器
npm run dev
```

访问 http://localhost:5173 查看管理端，API运行在 http://localhost:3456。

### 2. 分支策略

- `main`: 生产环境稳定版本
- `feature/*`: 新功能分支 (如 `feature/user-delete`)
- `fix/*`: Bug修复分支 (如 `fix/login-error`)
- `release/*`: 发版准备分支

**工作流程:**
```bash
# 从main创建功能分支
git checkout main
git pull origin main
git checkout -b feature/your-feature

# 开发完成后提交
git add .
git commit -m "feat: 添加用户删除功能"
git push origin feature/your-feature

# 创建Pull Request到main
```

### 3. Commit消息规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Type类型:**
- `feat`: 新功能
- `fix`: Bug修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建工具/脚本

**示例:**
```bash
feat(api): 添加用户数据删除接口

实现软删除和硬删除双模式，支持9表级联清理。

Closes #3
```

---

## 提交流程

### Pull Request要求

1. **标题清晰**: 简要描述改动内容
2. **关联Issue**: 在描述中引用相关Issue (如 `Fixes #123`)
3. **测试覆盖**: 新功能必须包含测试用例
4. **文档更新**: API变更需同步更新 `docs/API.md`

**PR模板:**
```markdown
## 改动说明
简要描述本次改动的目的和背景

## 改动内容
- 新增 xxx 接口
- 修复 xxx bug
- 优化 xxx 性能

## 测试验证
- [ ] 本地手动验证核心功能
- [ ] 单元测试通过
- [ ] 集成测试通过

## 截图/录屏 (如适用)
...

## 检查清单
- [ ] 代码符合规范
- [ ] 已添加必要注释
- [ ] 已更新相关文档
- [ ] 无console.log遗留
```

### Code Review要点

Reviewer会关注：
- 是否有安全漏洞（SQL注入、XSS等）
- 错误处理是否完善
- 是否有不必要的性能开销
- 代码可读性和可维护性
- 测试覆盖率是否足够

---

## 测试要求

### 测试分类

1. **单元测试** (`tests/*.test.ts`): 测试独立函数逻辑
2. **集成测试** (`tests/integration/*.test.ts`): 测试完整业务流程

### 编写测试

```typescript
import { describe, it, expect } from 'vitest';
import db from '../../api/db.js';

describe('User Service', () => {
  it('应该成功创建新用户', () => {
    const result = db.prepare(
      "INSERT INTO wx_users (openid, nickname) VALUES (?, ?)"
    ).run('test_openid', '测试用户');

    expect(result.lastInsertRowid).toBeGreaterThan(0);
  });

  it('应该能查询到新建用户', () => {
    const user = db.prepare(
      'SELECT * FROM wx_users WHERE openid = ?'
    ).get('test_openid');

    expect(user).toBeDefined();
    expect((user as any).nickname).toBe('测试用户');
  });
});
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test tests/integration/auth.test.ts

# 监听模式（开发时自动重跑）
npm test -- --watch
```

**测试覆盖率目标:** >70%

---

## 版本发布

### 版本号规范

采用语义化版本 `MAJOR.MINOR.PATCH`:
- **MAJOR**: 架构级变更或不兼容更新
- **MINOR**: 新功能向后兼容
- **PATCH**: Bug修复和小优化

### 发版流程

1. **更新版本号**
   ```bash
   # package.json
   "version": "2.8.0"

   # miniprogram/config.js
   APP_VERSION: 'v3.8.0'
   ```

2. **更新CHANGELOG.md**
   ```markdown
   ## [v2.8.0] - 2026-09-14

   ### 新增
   - ✨ OpenAPI文档生成功能
   - ✨ 集成测试套件

   ### 改进
   - ♻️ README文档完善

   ### 修复
   - 🐛 Swagger注解类型错误
   ```

3. **打标签并发布**
   ```bash
   git add .
   git commit -m "chore(release): v2.8.0"
   git tag v2.8.0
   git push origin main --tags
   ```

4. **创建GitHub Release**
   - 访问 https://github.com/caijuren/LearnGrow-CRM/releases
   - 点击 "Draft a new release"
   - 选择刚创建的tag
   - 复制CHANGELOG内容到描述

---

## 问题报告

### Bug报告

请在GitHub Issues中提供：

1. **问题描述**: 清楚描述遇到的问题
2. **复现步骤**: 详细操作步骤
3. **预期行为**: 期望的正确结果
4. **实际行为**: 实际出现的错误
5. **环境信息**:
   - 操作系统: Ubuntu 22.04 / macOS Sonoma
   - Node版本: v24.x
   - 浏览器: Chrome 120 / Safari 17
6. **截图/日志**: 如有可能，附上截图或控制台日志

**Bug报告模板:**
```markdown
### 问题描述
点击"删除用户"按钮后页面无响应

### 复现步骤
1. 登录管理后台
2. 进入微信用户列表
3. 点击任意用户的"删除"按钮
4. 确认删除

### 预期行为
弹出二次确认对话框

### 实际行为
页面无任何反应，控制台报错

### 环境信息
- OS: macOS Sonoma 14.2
- Node: v24.18.0
- Browser: Chrome 120.0.6099.109

### 错误日志
TypeError: Cannot read properties of undefined (reading 'id')
    at handleDelete (WxUserList.tsx:45)
```

### 功能建议

同样在Issues中提出，说明：
- 当前痛点是什么
- 建议的解决方案
- 预期的业务价值

---

## 联系方式

- **GitHub Issues**: https://github.com/caijuren/LearnGrow-CRM/issues
- **邮箱**: caijuren@example.com
- **企业微信**: LearnGrow开发团队

---

## 致谢

感谢每一位贡献者的时间和精力！🎉

你的贡献让LearnGrow CRM变得更好。
