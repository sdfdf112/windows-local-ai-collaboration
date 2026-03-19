/**
 * 任务协作平台 - 综合服务
 * 
 * 功能：
 * 1. 消息监听 (watcher) - 检测 messages/ 新文件 → 唤醒 AI
 * 2. HTTP API - 提供消息/任务/通知数据给前端
 */

const http = require('http');
const { execSync } = require('child_process');
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');

// ==================== 配置 ====================
const CONFIG = {
  msgDir: 'E:\\ClawCommunication\\messages',
  agents: {
    "wisp": { port: 18789 },
    "spark": { port: 19000 },
    "cipher": { port: 19100 },
    "nexus": { port: 19200 }
  },
  humans: ['wirth'],
  token: 'sdfdf112',
  openclawPath: 'C:\\Users\\sdfdf112\\AppData\\Local\\fnm_multishells\\10400_1773578706147\\openclaw.ps1'
};

const API_PORT = 3001;

// ==================== HTTP API ====================
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // 消息列表
    if (req.url === '/api/messages') {
      const files = fs.readdirSync(CONFIG.msgDir)
        .filter(f => f.endsWith('.json') && f !== 'counter.json')
        .sort().slice(-20);
      
      const messages = [];
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(CONFIG.msgDir, file), 'utf8');
          messages.push(JSON.parse(content));
        } catch (e) {}
      }
      res.end(JSON.stringify(messages));
      return;
    }

    // 任务列表
    if (req.url === '/api/tasks') {
      const content = fs.readFileSync('E:\\ClawCommunication\\tasks.md', 'utf8');
      res.end(JSON.stringify({ content }));
      return;
    }

    // 通知列表
    if (req.url === '/api/notifications') {
      try {
        const content = fs.readFileSync('E:\\ClawCommunication\\notifications.json', 'utf8');
        const data = JSON.parse(content);
        res.end(JSON.stringify(data.notifications || []));
      } catch (e) {
        res.end(JSON.stringify([]));
      }
      return;
    }

    res.end(JSON.stringify({ error: 'Not Found' }));
  } catch (e) {
    res.end(JSON.stringify({ error: e.message }));
  }
});

// ==================== 消息监听 ====================
const processedFiles = new Set();

function wakeAgent(agentName, agentConfig, msg) {
  console.log(`\n🔔 唤醒 ${agentName.toUpperCase()}...`);
  const taskMessage = `【新任务】来自 ${msg.from}: ${msg.content}`;
  const url = `ws://127.0.0.1:${agentConfig.port}`;

  try {
    execSync(
      `powershell -ExecutionPolicy Bypass -File "${CONFIG.openclawPath}" system event --text "${taskMessage}" --mode now --expect-final --url "${url}" --token ${CONFIG.token}`,
      { timeout: 120000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    console.log(`   ✅ 唤醒成功！`);
  } catch (err) {
    console.log(`   ❌ 唤醒失败: ${err.message}`);
  }
}

// 启动监听
const watcher = chokidar.watch(`${CONFIG.msgDir}/*.json`, {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 }
});

watcher.on('add', (filePath) => {
  const fileName = path.basename(filePath);
  if (processedFiles.has(fileName)) return;
  processedFiles.add(fileName);
  
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

// ==================== 启动 ====================
server.listen(API_PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 任务协作平台服务已启动');
  console.log('='.repeat(50));
  console.log(`📡 HTTP API: http://localhost:${API_PORT}`);
  console.log(`   - /api/messages      消息列表`);
  console.log(`   - /api/tasks       任务列表`);
  console.log(`   - /api/notifications 通知列表`);
  console.log('');
  console.log(`📂 监听目录: ${CONFIG.msgDir}`);
  console.log('='.repeat(50));
});
