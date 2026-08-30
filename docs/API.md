# LearnGrow CRM API 文档

**版本:** v2.7.0  
**最后更新:** 2026-08-30  
**Base URL:** `http://localhost:3456/api` (开发环境) / `https://your-domain.com/api` (生产环境)

---

## 认证说明

大多数API接口需要在请求头中携带JWT token进行认证：

```http
Authorization: Bearer <your_jwt_token>
```

Token通过登录接口获取，有效期7天。

---

## 错误响应格式

所有API错误遵循以下格式：

```json
{
  "success": false,
  "error": "错误描述信息"
}
```

### HTTP状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 资源创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证或认证失败 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 1. 认证接口

### POST /api/auth/login

管理端登录接口。

**请求体:**
```json
{
  "username": "admin",
  "password": "your_password"
}
```

**响应 (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin",
      "display_name": "管理员"
    }
  }
}
```

**错误响应 (401):**
```json
{
  "success": false,
  "error": "用户名或密码错误"
}
```

---

### GET /api/auth/me

获取当前登录用户信息。

**Headers:**
```
Authorization: Bearer <token>
```

**响应 (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "display_name": "管理员",
    "created_at": "2026-06-24T10:00:00Z"
  }
}
```

---

## 2. 微信用户管理

### GET /api/wx-users

获取微信用户列表（支持分页和筛选）。

**查询参数:**
- `page` (number): 页码，默认1
- `limit` (number): 每页数量，默认20，最大100
- `stage` (string): 用户阶段过滤
- `search` (string): 搜索关键词（昵称/手机号）
- `sort_by` (string): 排序字段，默认'created_at'
- `order` (string): 排序方向，'ASC'或'DESC'

**响应 (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "nickname": "张三",
        "name": "",
        "phone": "138****1234",
        "avatar_url": "/uploads/avatar.jpg",
        "stage": "interested",
        "importance": "normal",
        "tags": ["家长", "小学"],
        "total_spent": 1500,
        "order_count": 2,
        "last_order_date": "2026-08-20",
        "last_follow_date": "2026-08-25",
        "children": [
          {
            "id": 1,
            "nickname": "小明",
            "grade": "一年级"
          }
        ],
        "created_at": "2026-06-24T10:00:00Z"
      }
    ],
    "total": 150,
    "page": 1,
    "limit": 20
  }
}
```

---

### GET /api/wx-users/:id

获取单个微信用户详情（包含360度视图）。

**路径参数:**
- `id` (integer): 用户ID

**响应 (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nickname": "张三",
    "name": "张先生",
    "phone": "13800138000",
    "wechat_id": "wx_zhangsan",
    "stage": "interested",
    "importance": "vip",
    "tags": ["高意向", "已试听"],
    "total_spent": 1500,
    "order_count": 2,
    "follow_ups": [...],
    "orders": [...],
    "children": [...]
  }
}
```

---

### PUT /api/wx-users/:id

更新微信用户信息。

**请求体:**
```json
{
  "name": "张先生",
  "phone": "13800138000",
  "stage": "purchased",
  "importance": "vip",
  "tags": ["老客户", "续费"]
}
```

---

### DELETE /api/wx-users/:id

删除微信用户（支持软删除和硬删除）。

**请求体:**
```json
{
  "hard_delete": false,
  "reason": "用户主动要求删除"
}
```

**响应 (200):**
```json
{
  "success": true,
  "data": {
    "user_id": 1,
    "hard_delete": false,
    "cascade_deleted": {
      "children": 2,
      "checkin_participants": 5,
      "checkin_records": 10,
      "orders": 3,
      "follow_ups": 8,
      "points_ledger": 15,
      "checkin_likes": 3,
      "badge_achievements": 1
    },
    "audit_log_id": 100
  }
}
```

---

### POST /api/wx-users/batch-delete

批量软删除用户。

**请求体:**
```json
{
  "user_ids": [1, 2, 3],
  "reason": "清理测试数据"
}
```

---

## 3. 打卡管理

### GET /api/checkin-events

获取打卡活动列表。

**响应 (200):**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": 1,
        "title": "暑期阅读打卡",
        "description": "每天阅读30分钟",
        "start_date": "2026-07-01",
        "end_date": "2026-08-31",
        "status": "active",
        "participant_count": 50,
        "record_count": 1200
      }
    ]
  }
}
```

---

### POST /api/checkin-events

创建新的打卡活动。

**请求体:**
```json
{
  "title": "秋季运动打卡",
  "description": "每天运动30分钟",
  "start_date": "2026-09-01",
  "end_date": "2026-09-30",
  "signup_deadline": "2026-08-31",
  "rules": "上传运动截图即可",
  "points_per_checkin": 10
}
```

---

### POST /api/checkin-records

提交打卡记录。

**请求体 (multipart/form-data):**
- `event_id` (integer): 活动ID
- `participant_id` (integer): 参与者ID
- `media_type` (string): 'image' | 'video'
- `media_file` (file): 媒体文件
- `note` (string, optional): 备注

**响应 (201):**
```json
{
  "success": true,
  "data": {
    "id": 100,
    "status": "pending",
    "media_url": "/uploads/checkin_xxx.jpg",
    "created_at": "2026-08-30T14:30:00Z"
  }
}
```

---

### PUT /api/checkin-records/:id/approve

审核打卡记录。

**请求体:**
```json
{
  "status": "approved",
  "comment": "很棒！继续保持"
}
```

---

### GET /api/checkin-events/:id/stats

获取活动统计数据。

**响应 (200):**
```json
{
  "success": true,
  "data": {
    "event_id": 1,
    "total_participants": 50,
    "total_records": 1200,
    "approved_records": 1150,
    "pending_records": 50,
    "active_participants_7d": 35,
    "top_participants": [
      {
        "wx_user_id": 1,
        "nickname": "张三",
        "record_count": 30
      }
    ]
  }
}
```

---

## 4. 订单管理

### GET /api/orders

获取订单列表。

**查询参数:**
- `page` (number): 页码
- `limit` (number): 每页数量
- `wx_user_id` (integer): 按用户过滤
- `product_id` (integer): 按产品过滤
- `status` (string): 订单状态

**响应 (200):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": 1,
        "wx_user_id": 1,
        "product_id": 1,
        "product_name": "暑期班",
        "amount": 800,
        "purchase_date": "2026-07-01",
        "status": "completed",
        "points_granted": 80,
        "notes": ""
      }
    ],
    "total": 50,
    "page": 1,
    "limit": 20
  }
}
```

---

### POST /api/orders

创建新订单。

**请求体:**
```json
{
  "wx_user_id": 1,
  "product_id": 1,
  "amount": 800,
  "purchase_date": "2026-08-30",
  "status": "completed",
  "notes": "老学员续费"
}
```

**响应 (201):**
```json
{
  "success": true,
  "data": {
    "id": 51,
    "points_granted": 80
  }
}
```

---

## 5. 产品管理

### GET /api/products

获取产品列表。

**响应 (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "暑期班",
      "price": 800,
      "points_ratio": 0.1,
      "description": "暑期集训课程",
      "is_active": true
    }
  ]
}
```

---

### POST /api/products

创建新产品。

**请求体:**
```json
{
  "name": "秋季班",
  "price": 1000,
  "points_ratio": 0.1,
  "description": "秋季常规课程",
  "is_active": true
}
```

---

## 6. 孩子档案

### GET /api/children?wx_user_id=:id

获取指定用户的孩子列表。

**响应 (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "wx_user_id": 1,
      "nickname": "小明",
      "real_name": "张小明",
      "gender": "male",
      "grade": "一年级",
      "school": "实验小学",
      "birthday": "2018-05-20",
      "learning_path_id": 1
    }
  ]
}
```

---

### POST /api/children

创建孩子档案。

**请求体:**
```json
{
  "wx_user_id": 1,
  "nickname": "小明",
  "real_name": "张小明",
  "gender": "male",
  "grade": "一年级",
  "school": "实验小学",
  "birthday": "2018-05-20"
}
```

---

## 7. 系统接口

### GET /api/health

健康检查接口。

**响应 (200):**
```json
{
  "success": true,
  "message": "ok",
  "version": "2.7.0"
}
```

---

### GET /api/version

获取当前版本号。

**响应 (200):**
```json
{
  "success": true,
  "data": {
    "version": "2.7.0"
  }
}
```

---

### POST /api/backups/create

手动创建数据库备份。

**响应 (201):**
```json
{
  "success": true,
  "data": {
    "name": "backup_20260830143000.zip",
    "size": 1048576,
    "path": "/var/www/learngrow-crm/backups/backup_20260830143000.zip"
  }
}
```

---

### GET /api/backups/list

获取备份文件列表。

**响应 (200):**
```json
{
  "success": true,
  "data": [
    {
      "name": "backup_20260830143000.zip",
      "size": 1048576,
      "created_at": "2026-08-30T14:30:00Z"
    }
  ]
}
```

---

## 附录

### 用户阶段枚举

| 值 | 说明 |
|----|------|
| new_friend | 新朋友 |
| initial_chat | 初步沟通 |
| interested | 有意向 |
| purchased | 已购买 |
| in_group | 进群学习 |
| repurchased | 复购 |
| silent | 沉默用户 |

### 重要性枚举

| 值 | 说明 |
|----|------|
| vip | VIP用户 |
| normal | 普通用户 |
| low | 低优先级 |

### 打卡活动状态

| 值 | 说明 |
|----|------|
| draft | 草稿 |
| active | 进行中 |
| completed | 已结束 |
| cancelled | 已取消 |

### 订单状态

| 值 | 说明 |
|----|------|
| pending | 待支付 |
| completed | 已完成 |
| refunded | 已退款 |
| cancelled | 已取消 |

---

**维护说明:** 
- 本文档由人工维护，每次新增API后需同步更新
- Swagger UI可通过访问 `/api-docs` 查看自动生成的交互式文档
- 有问题请联系开发团队
