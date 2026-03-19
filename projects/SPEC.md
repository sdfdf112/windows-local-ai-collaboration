# 任务协作平台 - 技术规格说明书

> 版本：v2.2 (最终版)  
> 日期：2026-03-15  
> 项目类型：本地桌面应用 (Tauri) + 多AI协作  
> 审核监督：Gemini

---

## 1. 项目概述

### 1.1 项目背景

- **目标**：让 Wirth（人类）和 4个AI（Wisp/Spark/Cipher/Nexus）本地协作
- **核心**：通过文件传递消息，AI 被唤醒后处理任务

---

## 2. 通信方式

### 2.1 文件传递（主要方式）

消息通过 `messages/` 目录的 JSON 文件传递：

```
写入消息 → messages/001.json → watcher.js 检测 → 唤醒AI
```

**优点**：
- ✅ 简单可靠
- ✅ 不需要实时连接
- ✅ 上下文保持连贯

### 2.2 AI 状态检测

通过检测 Gateway 端口是否响应来判断 AI 是否在线：

| AI | Gateway 端口 | 状态 |
|----|-------------|------|
| Wisp | 18789 | 端口响应 = 在线 |
| Spark | 19000 | 端口响应 = 在线 |
| Cipher | 19100 | 端口响应 = 在线 |
| Nexus | 19200 | 端口响应 = 在线 |

前端每3秒检测一次端口，实时显示 AI 在线状态。

### 2.3 Socket.io（已移除）

~~实时通信、状态显示~~ - **已移除**

原因：
- 前端模拟 AI 连接导致状态不准确
- 文件传递已足够使用
- 简化架构

---

## 3. 解决方案：System Event

使用 `openclaw system event` 唤醒 AI：

```bash
openclaw system event --text "任务内容" --mode now --expect-final --url "ws://127.0.0.1:19000" --token sdfdf112
```

**优点**：
- ✅ 消息注入当前会话
- ✅ 上下文保持连贯
- ✅ AI 在各自对话框回复
- ✅ 支持多 Gateway

---

## 4. watcher.js

### 4.1 功能

- 监控 `messages/` 目录
- 检测新消息文件
- 根据 `to` 字段唤醒对应 AI
- 支持多 Gateway（18789/19000/19100/19200）

### 4.2 配置

```javascript
const CONFIG = {
  msgDir: 'E:\\ClawCommunication\\messages',
  
  agents: {
    "wisp": { port: 18789 },
    "spark": { port: 19000 },
    "cipher": { port: 19100 },
    "nexus": { port: 19200 }
  },
  
  token: 'sdfdf112',
  openclawPath: 'C:\\Users\\sdfdf112\\AppData\\Local\\fnm_multishells\\10400_1773578706147\\openclaw.ps1'
};
```

### 4.3 启动

```bash
cd E:/ClawCommunication/scripts
node watcher.js
```

---

## 5. 消息格式

```json
{
  "id": "001",
  "type": "test",
  "from": "wirth",
  "to": ["wisp"],
  "next": "spark",
  "content": "任务内容",
  "timestamp": "2026-03-15T12:00:00Z",
  "readBy": []
}
```

**字段说明：**
- `id`: 消息唯一标识
- `type`: 消息类型 (test/task/normal)
- `from`: 发送者
- `to`: 接收AI列表
- `next`: 下一位需要通知的AI（可选，用于轮换场景）
- `content`: 消息内容
- `timestamp`: 时间戳
- `readBy`: 已读取的接收者

---

## 6. 工作流程

```
用户/AI 写入消息
        ↓
messages/001.json
        ↓
watcher.js 检测到新文件
        ↓
读取 to 字段
        ↓
根据端口映射唤醒对应 AI
        ↓
AI 在各自对话框处理任务
        ↓
一般无需回复，如有需要直接在对话框回复
```

---

## 7. 启动指令

### 必须启动

**watcher.js (AI 唤醒)**

```bash
cd E:/ClawCommunication/scripts
node watcher.js
```

### 可选启动

**前端开发**

```bash
cd E:/ClawCommunication/任务协作平台
npm install
npm run dev
```

**构建桌面应用**

```bash
cd E:/ClawCommunication/任务协作平台
npm run tauri build
```

---

## 8. 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v3.8 | 2026-03-12 | 初始版，使用 HTTP API |
| v5.5 | 2026-03-15 | 改用 openclaw agent |
| v6.1 | 2026-03-15 | 改用 system event |
| v7.2 | 2026-03-15 | 支持多 Gateway |
| v2.2 | 2026-03-15 | 移除 Socket.io，简化架构 |

---

## 9. 验收标准

- [x] watcher.js 能检测 messages/ 新文件
- [x] 能根据 to 字段唤醒对应 AI
- [x] AI 能在各自对话框收到任务
- [x] 上下文保持连贯
- [x] 支持多 AI（Wisp/Spark/Cipher/Nexus）
- [x] Gateway 端口检测 AI 在线状态

---

## 10. 安全说明

所有服务均运行在本地：
- Gateway: 127.0.0.1:18789/19000/19100/19200

**未暴露到公网，仅本地可用。**

---

*本文档由 Wisp 编写，记录任务协作平台的完整解决方案*
