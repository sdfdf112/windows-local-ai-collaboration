/**
 * 任务协作平台 - 配置文件
 * 
 * 修改此文件即可调整配置，无需修改主程序
 */

// 加载环境变量
require('dotenv').config();

module.exports = {
  // 服务端口
  port: 3000,

  // 消息目录
  msgDir: 'E:\\ClawCommunication\\messages',

  // AI 配置 - 各自端口的 Gateway
  agents: {
    "wisp": { port: 18789 },
    "spark": { port: 19000 },
    "cipher": { port: 19100 },
    "nexus": { port: 19200 },
    "pulse": { port: 19300 },
    "flux": { port: 19400 },
    "nova": { port: 19500 }
  },

  // 人类用户列表（发给人类的消息不触发 AI）
  humans: ['wirth'],

  // OpenClaw Gateway 配置（从环境变量读取）
  token: process.env.OPENCLAW_TOKEN || '',
  openclawPath: process.env.OPENCLAW_PATH || '',

  // 监听配置
  timeout: 120000,   // AI 唤醒超时 120秒
  maxRetries: 3,     // 最大重试次数

  // 日志配置
  logDir: 'E:\\ClawCommunication\\logs',
  logFile: 'platform.log'
};
