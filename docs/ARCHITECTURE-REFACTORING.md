# LearnGrow CRM 架构重构指南

**版本:** v2.9.0  
**最后更新:** 2026-08-30  
**状态:** 进行中（认证模块已完成）

---

## 📋 概述

v2.9.0将单体 `api/app.ts` (3207行) 重构为清晰的三层架构，提升代码可维护性和团队协作效率。

### 重构目标

- ✅ `api/app.ts` < 200行（仅负责插件注册和路由挂载）
- ✅ 单个文件 < 500行
- ✅ 无循环依赖
- ✅ TypeScript严格模式开启

---

## 🏗️ 新架构结构

```
api/
├── app.ts                    # 应用入口（插件注册 + 路由挂载）
├── db.ts                     # 数据库连接（保持不变）
│
├── routes/                   # 路由层 - HTTP请求/响应处理
│   ├── index.ts              # 统一注册入口
│   ├── auth.routes.ts        # ✅ 已完成 - 认证相关接口
│   ├── wxUser.routes.ts      # ⏳ 待拆分 - 微信用户管理
│   ├── checkin.routes.ts     # ⏳ 待拆分 - 打卡相关
│   ├── order.routes.ts       # ⏳ 待拆分 - 订单管理
│   └── ...
│
├── services/                 # 服务层 - 业务逻辑封装
│   ├── auth.service.ts       # ✅ 已完成 - 认证业务逻辑
│   ├── checkin.service.ts    # ⏳ 待抽取 - 打卡统计/排名
│   ├── points.service.ts     # ⏳ 待抽取 - 积分计算
│   └── ...
│
├── repositories/             # 仓储层 - 数据访问抽象
│   ├── base.repo.ts          # ⏳ 待创建 - 通用CRUD
│   ├── wxUser.repo.ts        # ⏳ 待创建 - 用户数据访问
│   └── ...
│
└── middleware/               # 中间件 - 横切关注点
    ├── auth.middleware.ts    # ✅ 已完成 - JWT验证/权限检查
    ├── rateLimit.middleware.ts # ⏳ 待抽取 - 请求限流
    └── errorHandler.middleware.ts # ⏳ 待抽取 - 全局错误处理
```

---

## ✅ 已完成模块

### 1. 认证模块重构

#### 中间件层 (`api/middleware/auth.middleware.ts`)

**提供功能:**
- `allowAdminLogin()` - 登录限流（15分钟最多10次尝试）
- `authMiddleware()` - JWT token验证
- `adminOnly()` - 管理员权限检查
- `operatorOrAbove()` - 运营人员及以上权限
- `wxAuthMiddleware()` - 微信小程序认证
- `wxOptionalAuthMiddleware()` - 可选微信认证

**使用示例:**
```typescript
import { authMiddleware, adminOnly } from '../middleware/auth.middleware.js';

// 需要登录的接口
app.get('/api/protected', { preHandler: [authMiddleware] }, handler);

// 仅管理员可访问
app.delete('/api/users/:id', { preHandler: [adminOnly] }, handler);
```

#### 服务层 (`api/services/auth.service.ts`)

**提供功能:**
- `loginUser(username, password)` - 用户登录验证
- `getUserById(userId)` - 获取用户信息
- `createUser(userData)` - 创建新用户
- `updateUser(userId, updateData)` - 更新用户信息
- `deleteUser(userId)` - 删除用户
- `listUsers()` - 列出所有用户

**使用示例:**
```typescript
import { loginUser } from '../services/auth.service.js';

const result = await loginUser('admin', 'password123');
if (result.success) {
  console.log(result.user); // { id, username, role, display_name }
}
```

#### 路由层 (`api/routes/auth.routes.ts`)

**接口列表:**
- `POST /api/auth/login` - 管理端登录（含Swagger文档）
- `GET /api/auth/me` - 获取当前用户信息

**特点:**
- 完整的OpenAPI schema注解
- 参数验证（zod）
- 错误处理规范化

---

## 🔄 迁移步骤（其他模块参考）

### 第1步: 识别代码边界

在 `api/app.ts` 中找到要拆分的模块：

```bash
# 查找所有路由定义
grep -n "app\.\(get\|post\|put\|delete\)" api/app.ts
```

### 第2步: 创建路由文件

复制相关代码到新文件，例如 `api/routes/wxUser.routes.ts`:

```typescript
import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { listWxUsers, getWxUserById } from '../services/wxUser.service.js';

export async function registerWxUserRoutes(app: FastifyInstance) {
  app.get('/api/wx-users', { preHandler: [authMiddleware] }, async (request, reply) => {
    // 从服务层获取数据
    const users = listWxUsers();
    return { success: true, data: users };
  });

  app.get('/api/wx-users/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const id = parseInt(request.params.id);
    const user = getWxUserById(id);
    if (!user) return reply.code(404).send({ success: false, error: '用户不存在' });
    return { success: true, data: user };
  });
}
```

### 第3步: 抽取服务层

将业务逻辑从路由移到service:

```typescript
// api/services/wxUser.service.ts
import db from '../db.js';

export function listWxUsers() {
  return db.prepare('SELECT * FROM wx_users ORDER BY created_at DESC').all();
}

export function getWxUserById(id: number) {
  return db.prepare('SELECT * FROM wx_users WHERE id = ?').get(id);
}
```

### 第4步: 注册新路由

在 `api/routes/index.ts` 中添加:

```typescript
import { registerWxUserRoutes } from './wxUser.routes.js';

export async function registerAllRoutes(app: FastifyInstance) {
  await registerAuthRoutes(app);
  await registerWxUserRoutes(app); // 新增
  // ...
}
```

### 第5步: 测试验证

```bash
# 运行类型检查
npm run check

# 运行测试
npm test

# 本地启动验证
npm run dev
```

---

## 📊 进度追踪

| 模块 | 路由文件 | 服务文件 | 仓储文件 | 状态 |
|------|---------|---------|---------|------|
| 认证 | ✅ auth.routes.ts | ✅ auth.service.ts | - | ✅ 已完成 |
| 微信用户 | ⏳ | ⏳ | ⏳ | ⏳ 待拆分 |
| 打卡 | ⏳ | ⏳ | ⏳ | ⏳ 待拆分 |
| 订单 | ⏳ | ⏳ | ⏳ | ⏳ 待拆分 |
| 驾驶舱 | ⏳ | ⏳ | - | ⏳ 待拆分 |
| 产品 | ⏳ | - | - | ⏳ 待拆分 |
| 孩子档案 | ⏳ | - | - | ⏳ 待拆分 |
| 微信群 | ⏳ | - | - | ⏳ 待拆分 |
| 素材库 | ⏳ | - | - | ⏳ 待拆分 |
| 系统配置 | ⏳ | - | - | ⏳ 待拆分 |
| 备份恢复 | ⏳ | ✅ backup.ts | - | ⏳ 部分完成 |
| 用户删除 | ✅ | ✅ user-delete.service.ts | - | ✅ 已完成 |

---

## ⚠️ 注意事项

### 导入路径

重构后使用相对路径导入：

```typescript
// ❌ 旧方式（直接从app.ts中引用）
import { authMiddleware } from '../app.js';

// ✅ 新方式
import { authMiddleware } from '../middleware/auth.middleware.js';
```

### 循环依赖避免

不要形成以下依赖环：

```
routes → services → routes  ❌
services → repositories → services  ❌

正确方向:
routes → services → repositories  ✅
```

### TypeScript类型

保持类型安全：

```typescript
// ❌ 避免any
const user = db.prepare('...').get(id) as any;

// ✅ 明确类型
interface User {
  id: number;
  username: string;
  role: string;
}
const user = db.prepare('...').get(id) as User | undefined;
```

---

## 🧪 测试策略

### 单元测试

测试服务层纯函数：

```typescript
// tests/services/auth.service.test.ts
import { describe, it, expect } from 'vitest';
import { loginUser } from '../../api/services/auth.service.js';

describe('auth service', () => {
  it('should login with valid credentials', async () => {
    const result = await loginUser('testuser', 'testpass');
    expect(result.success).toBe(true);
  });
});
```

### 集成测试

测试完整路由流程：

```typescript
// tests/integration/auth.test.ts
import { describe, it, expect } from 'vitest';

describe('Authentication API', () => {
  it('should login successfully', async () => {
    const response = await fetch('http://localhost:3456/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', password: 'testpass' })
    });
    expect(response.status).toBe(200);
  });
});
```

---

## 📝 下一步行动

1. **继续拆分微信用户模块** - `api/routes/wxUser.routes.ts`
2. **抽取打卡服务层** - `api/services/checkin.service.ts`
3. **创建基础仓储类** - `api/repositories/base.repo.ts`
4. **整理剩余中间件** - 限流、错误处理等
5. **开启TypeScript严格模式** - 修复类型错误

预计完成时间: 2026-09-30

---

**维护者:** 开发团队  
**相关问题:** GitHub Issue #v2.9.0
