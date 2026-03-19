/**
 * 任务协作平台 - 配置文件（示例）
 * 
 * 复制此文件为 config.js 并修改配置
 */

// 加载环境变量
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// 基础目录（项目根目录）
const BASE_DIR = path.join(__dirname, '..');

module.exports = {
  // 服务端口
  port: parseInt(process.env.PORT) || 3000,

  // 项目根目录
  baseDir: BASE_DIR,

  // 消息目录（相对路径）
  msgDir: path.join(BASE_DIR, 'messages'),

  // AI 配置（从环境变量读取，格式：AI名称:端口,AI名称:端口）
  // 示例: wisp:18789,spark:19000,cipher:19100
  agents: (process.env.AGENTS || 'wisp:18789,spark:19000').split(',').reduce((acc, s) => {
    const [name, port] = s.trim().split(':');
    if (name && port) acc[name.trim()] = { port: parseInt(port) };
    return acc;
  }, {}),

  // 人类用户列表（发给人类的消息不触发 AI）
  // 示例: wirth,alice,bob
  humans: (process.env.HUMANS || 'wirth').split(',').map(s => s.trim()),

  // OpenClaw Gateway 配置（从环境变量读取）
  token: process.env.OPENCLAW_TOKEN || '',
  openclawPath: process.env.OPENCLAW_PATH || '',

  // 监听配置
  timeout: parseInt(process.env.TIMEOUT) || 120000,   // AI 唤醒超时 120秒
  maxRetries: parseInt(process.env.MAX_RETRIES) || 3, // 最大重试次数

  // 日志配置（相对路径）
  logDir: path.join(BASE_DIR, 'logs'),
  logFile: 'platform.log'
};
