/**
 * 龙虾基站监控服务 v7.5 - 支持next字段
 * 
 * 支持多Gateway + 超时重试 + next字段
 */

const chokidar = require('chokidar');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  msgDir: 'E:\\ClawCommunication\\messages',

  // AI 配置 - 各自端口的 Gateway
  agents: {
    "wisp": { port: 18789 },
    "spark": { port: 19000 },
    "cipher": { port: 19100 },
    "nexus": { port: 19200 }
  },

  humans: ['wirth'],
  token: 'sdfdf112',
  openclawPath: 'C:\\Users\\sdfdf112\\AppData\\Local\\fnm_multishells\\10400_1773578706147\\openclaw.ps1',
  
  // 超时和重试配置
  timeout: 120000,  // 120秒超时
  maxRetries: 3     // 最多重试3次
};

console.log('------------------------------------------');
console.log('🚀 龙虾基站监控系统 v7.5');
console.log('🔗 模式: 同步执行 + 超时重试 + next字段');
console.log('------------------------------------------');

const processedFiles = new Set();

function wakeAgent(agentName, agentConfig, msg) {
  const taskMessage = `【新任务】来自 ${msg.from}: ${msg.content}`;
  const url = `ws://127.0.0.1:${agentConfig.port}`;
  const cmd = `powershell -ExecutionPolicy Bypass -File "${CONFIG.openclawPath}" system event --text "${taskMessage}" --mode now --expect-final --url "${url}" --token ${CONFIG.token}`;

  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    console.log(`\n🔔 唤醒 ${agentName.toUpperCase()}... (尝试 ${attempt}/${CONFIG.maxRetries})`);
    
    try {
      execSync(cmd, { timeout: CONFIG.timeout, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      console.log(`   ✅ 唤醒成功！`);
      return;  // 成功就退出
    } catch (err) {
      console.log(`   ⚠️ 尝试 ${attempt} 失败: ${err.message}`);
      if (attempt < CONFIG.maxRetries) {
        console.log(`   ⏳ 3秒后重试...`);
        // 等待3秒再重试
        const start = Date.now();
        while (Date.now() - start < 3000) { /* busy wait */ }
      }
    }
  }
  
  console.log(`   ❌ 唤醒失败，已达最大重试次数`);
}

if (!fs.existsSync(CONFIG.msgDir)) fs.mkdirSync(CONFIG.msgDir, { recursive: true });

const watcher = chokidar.watch(`${CONFIG.msgDir}/*.json`, {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 }
});

watcher.on('add', (filePath) => {
  const fileName = path.basename(filePath);
  const mtime = fs.statSync(filePath).mtimeMs;
  const fileKey = `${fileName}@${mtime}`;
  
  if (processedFiles.has(fileKey)) return;
  processedFiles.add(fileKey);
  
  console.log(`\n[${new Date().toLocaleTimeString()}] 📩 捕获新文件: ${fileName}`);

  try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    const msg = JSON.parse(rawData.replace(/^\uFEFF/, ''));

    if (msg.type === 'system') return;

    if (msg.to && msg.to.length > 0) {
      const allHumans = msg.to.every(t => CONFIG.humans.includes(t.toLowerCase()));
      if (allHumans) {
        console.log(`   💬 发给人类，不触发AI`);
        return;
      }
    }

    let recipients = [];
    if (msg.to && msg.to.length > 0) {
      recipients = msg.to.filter(t => CONFIG.agents[t.toLowerCase()]);
    } else {
      recipients = Object.keys(CONFIG.agents);
    }

    if (recipients.length === 0) {
      console.log(`   ⚠️ 无AI目标`);
      return;
    }

    // 如果有 next 字段，提醒AI通知下一位
    if (msg.next) {
      console.log(`   📢 提示: 需通知下一位 [${msg.next}]`);
    }

    recipients.forEach(name => {
      const lowerName = name.toLowerCase();
      const agentConfig = CONFIG.agents[lowerName];
      if (agentConfig) {
        wakeAgent(lowerName, agentConfig, msg);
      }
    });

  } catch (err) {
    console.error('   ❌ 解析失败:', err.message);
  }
});

// 监听文件修改（覆盖写同一个文件时触发）
watcher.on('change', (filePath) => {
  const fileName = path.basename(filePath);
  const mtime = fs.statSync(filePath).mtimeMs;
  const fileKey = `${fileName}@${mtime}`;
  
  if (processedFiles.has(fileKey)) return;
  processedFiles.add(fileKey);
  
  console.log(`\n[${new Date().toLocaleTimeString()}] 📝 文件变更: ${fileName}`);

  try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    const msg = JSON.parse(rawData.replace(/^\uFEFF/, ''));

    if (msg.type === 'system') return;

    if (msg.to && msg.to.length > 0) {
      const allHumans = msg.to.every(t => CONFIG.humans.includes(t.toLowerCase()));
      if (allHumans) {
        console.log(`   💬 发给人类，不触发AI`);
        return;
      }
    }

    let recipients = [];
    if (msg.to && msg.to.length > 0) {
      recipients = msg.to.filter(t => CONFIG.agents[t.toLowerCase()]);
    } else {
      recipients = Object.keys(CONFIG.agents);
    }

    if (recipients.length === 0) {
      console.log(`   ⚠️ 无AI目标`);
      return;
    }

    if (msg.next) {
      console.log(`   📢 提示: 需通知下一位 [${msg.next}]`);
    }

    recipients.forEach(name => {
      const lowerName = name.toLowerCase();
      const agentConfig = CONFIG.agents[lowerName];
      if (agentConfig) {
        wakeAgent(lowerName, agentConfig, msg);
      }
    });

  } catch (err) {
    console.error('   ❌ 解析失败:', err.message);
  }
});

console.log(`📡 监听中: ${CONFIG.msgDir}`);
