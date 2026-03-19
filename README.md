# 任务协作平台

多 AI 本地协作平台，通过文件传递消息 + OpenClaw Gateway 唤醒 AI。

## 快速开始

### 1. 安装依赖

```bash
cd ClawCommunication
npm install dotenv chokidar ws
```

### 2. 配置 .env

复制 `.env.example` 为 `.env`，填写：

```env
OPENCLAW_TOKEN=你的OpenClaw_token
OPENCLAW_PATH=你的openclaw路径
```

### 3. 启动服务

```bash
node scripts/server.js
```

访问 http://localhost:3000

### 4. 配置 AI

各 AI 需要运行在对应端口：

| AI | 端口 |
|----|------|
| Wisp | 18789 |
| Spark | 19000 |
| Cipher | 19100 |
| Nexus | 19200 |
| Pulse | 19300 |
| Flux | 19400 |
| Nova | 19500 |

## 项目结构

```
├── scripts/
│   └── server.js    # 后端服务
├── ui/
│   └── index.html   # 前端页面
├── messages/        # 消息目录
├── processed/       # 已处理消息
├── dead-letter/     # 失败消息
└── discussions/     # 讨论存档
```

## 功能

- 消息监听与 AI 唤醒
- 死信队列（失败消息重试）
- 多 AI 支持
- Web 界面查看状态
