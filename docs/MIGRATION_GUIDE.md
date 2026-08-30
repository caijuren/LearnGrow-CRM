# 数据库迁移指南

本文档说明如何使用 Drizzle Kit 管理数据库 schema 变更和迁移。

## 前置条件

确保已安装依赖：

```bash
npm install drizzle-kit drizzle-orm
```

## 配置文件

- **Schema 定义**: `api/schema.ts` - Drizzle ORM 表定义
- **迁移配置**: `drizzle.config.ts` - Drizzle Kit 配置
- **迁移脚本目录**: `migrations/` - 存放生成的 SQL 迁移文件

## 工作流程

### 1. 修改 Schema

当需要添加/修改/删除表或字段时，编辑 `api/schema.ts` 文件。

示例：添加新字段

```typescript
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  // ... 其他字段
  email: text('email'), // 新增字段
});
```

### 2. 生成迁移脚本

```bash
npx drizzle-kit generate --config=drizzle.config.ts
```

这会在 `migrations/` 目录下生成新的 SQL 文件，文件名格式为 `NNNN_description.sql`。

### 3. 审查迁移脚本

**重要**: 在应用迁移前，务必审查生成的 SQL 文件，确保：

- 不会意外删除数据
- 外键约束正确
- 默认值符合预期
- 索引定义完整

### 4. 本地测试迁移

创建测试数据库验证迁移：

```bash
# 使用空数据库测试
DATA_DIR=./test-data npx drizzle-kit migrate --config=drizzle.config.ts
```

### 5. 应用到生产环境

```bash
# 生产环境执行迁移
NODE_ENV=production DATA_DIR=/path/to/prod/data npx drizzle-kit migrate --config=drizzle.config.ts
```

或使用生产迁移脚本：

```bash
./scripts/migrate-prod.sh
```

## 回滚机制

每个迁移文件都包含对应的 `down.sql` 文件（位于 `migrations/meta/`），用于回滚操作。

### 回滚到上一个版本

```bash
npx drizzle-kit revert --config=drizzle.config.ts
```

### 注意事项

- 回滚会撤销最近一次迁移的所有更改
- **警告**: 如果迁移包含数据修改（INSERT/UPDATE），回滚不会恢复原始数据
- 生产环境回滚前必须备份数据库

## 最佳实践

### Do's

- ✅ 每次 schema 变更都生成迁移脚本
- ✅ 在提交代码前测试迁移
- ✅ 在生产环境执行前先本地验证
- ✅ 保留历史迁移文件作为审计记录
- ✅ 迁移失败时自动回滚（Drizzle Kit 使用事务保护）

### Don'ts

- ❌ 不要手动编辑生成的迁移文件
- ❌ 不要在已有数据的表上删除非空字段
- ❌ 不要跳过迁移直接修改数据库
- ❌ 不要在生产环境直接执行未测试的迁移

## 常见问题

### Q: 迁移失败怎么办？

A: Drizzle Kit 使用事务保护，失败会自动回滚。检查错误信息，修正 schema 定义后重新生成。

### Q: 如何查看当前数据库版本？

A: 查看 `migrations/meta/_journal.json` 文件，记录了已应用的迁移历史。

### Q: 可以合并多个迁移吗？

A: 不建议。每个迁移应该代表一个独立的 schema 变更，便于追踪和回滚。

### Q: 如何处理种子数据？

A: 种子数据（如初始管理员账号、产品列表）应保留在 `api/db.ts` 中，不在迁移文件中处理。

## 从 api/db.ts 迁移

当前项目采用混合模式：

- **api/db.ts**: 保留用于早期迁移逻辑和种子数据
- **api/schema.ts**: Drizzle ORM 类型化定义，用于后续开发
- **migrations/**: 增量迁移脚本

未来计划完全迁移到 Drizzle ORM，届时将移除 `api/db.ts` 中的 CREATE TABLE 语句。

## 参考资源

- [Drizzle ORM 文档](https://orm.drizzle.team/)
- [Drizzle Kit CLI 参考](https://orm.drizzle.team/kit-docs/cli-reference)
- [SQLite 迁移最佳实践](https://www.sqlite.org/lang_altertable.html)
