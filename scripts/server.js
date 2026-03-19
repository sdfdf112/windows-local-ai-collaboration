/**
 * ClawCommunication 后端服务
 * 负责：API服务、消息监听、AI唤醒
 */

const http = require('http');
const { exec } = require('child_process');
const util = require('util');
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');

const execPromise = util.promisify(exec);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==================== 1. 配置加载 ====================
const CONFIG = require('./config');
const PORT = CONFIG.port || 3000;

// ==================== 2. 死信队列目录 ====================
const processedDir = path.join(CONFIG.msgDir, '..', 'processed');
const deadLetterDir = path.join(CONFIG.msgDir, '..', 'dead-letter');
const processedFiles = new Set();

[processedDir, deadLetterDir].forEach(dir => { 
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); 
});

// 加载已处理消息
function loadProcessedMessages() {
  try {
    const files = fs.readdirSync(processedDir).filter(f => f.endsWith('.json'));
    files.forEach(f => processedFiles.add(f.replace('.json', '')));
    log('INFO', '已加载 ' + processedFiles.size + ' 条处理记录');
  } catch (e) { log('WARN', '初始化记录失败: ' + e.message); }
}
loadProcessedMessages();

// 标记消息已处理
function markMessageProcessed(msg, aiName, success) {
  const msgId = String(msg.id);
  processedFiles.add(msgId);
  const f = path.join(processedDir, msgId + '.json');
  let pm = {};
  if (fs.existsSync(f)) try { pm = JSON.parse(fs.readFileSync(f, 'utf8')); } catch(e) {}
  if (!pm.processedBy) pm.processedBy = [];
  if (!pm.failedBy) pm.failedBy = [];
  if (success) { 
    if (!pm.processedBy.includes(aiName)) pm.processedBy.push(aiName); 
    pm.failedBy = pm.failedBy.filter(a => a !== aiName); 
  } else { 
    if (!pm.failedBy.includes(aiName)) pm.failedBy.push(aiName); 
  }
  pm.processedAt = new Date().toISOString();
  try { fs.writeFileSync(f, JSON.stringify(pm, null, 2)); } catch(e) {}
}

// 存入死信队列
function saveToDeadLetter(msg, errorMsg) {
  const ts = Date.now();
  const msgId = msg.id || 'unknown';
  const deadLetter = Object.assign({}, msg, { error: errorMsg, failedAt: new Date().toISOString(), retryCount: CONFIG.maxRetries });
  try { 
    fs.writeFileSync(path.join(deadLetterDir, ts + '_' + msgId + '.json'), JSON.stringify(deadLetter, null, 2)); 
    log('WARN', '消息 ' + msgId + ' 已存入死信队列');
  } catch(e) { log('ERROR', '存入死信队列失败: ' + e.message); }
}

// ==================== 3. 日志 ====================
const LOG_DIR = CONFIG.logDir;
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function log(level, msg) {
  const time = new Date().toISOString();
  const line = '[' + time + '] [' + level + '] ' + msg;
  process.stdout.write(line + '\n');
  try { fs.appendFileSync(path.join(LOG_DIR, CONFIG.logFile), line + '\n'); } catch(e) {}
}

// ==================== 4. 静态文件服务 ====================
const HTML = fs.readFileSync(path.join(__dirname, '..', 'ui', 'index.html'), 'utf8');

// ==================== 5. API 与 监听核心 ====================
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = req.url;

  if (url === '/' || url === '/index.html') {
    res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
    return res.end(HTML);
  }

  try {
    // 消息列表 API
    if (url === '/api/messages') {
      const files = fs.readdirSync(CONFIG.msgDir).filter(f => f.endsWith('.json') && f !== 'counter.json').sort().slice(-20).reverse();
      let data;
      try {
        data = files.map(f => {
          const raw = fs.readFileSync(path.join(CONFIG.msgDir, f), 'utf8');
          const clean = raw.replace(/^\uFEFF/, '').trim();
          return JSON.parse(clean);
        });
      } catch(e) {
        data = [];
      }
      
      // 获取已处理消息状态
      const processedStatus = {};
      try {
        const list = fs.readdirSync(processedDir).filter(f => f.endsWith('.json'));
        list.forEach(f => {
          const msgId = f.replace('.json', '');
          try {
            const content = JSON.parse(fs.readFileSync(path.join(processedDir, f), 'utf8'));
            processedStatus[msgId] = { processedBy: content.processedBy || [], failedBy: content.failedBy || [] };
          } catch(e) {}
        });
      } catch(e) {}
      
      data.forEach(msg => {
        const status = processedStatus[String(msg.id)] || { processedBy: [], failedBy: [] };
        msg.processedBy = status.processedBy;
        msg.failedBy = status.failedBy;
      });
      
      res.writeHead(200, {'Content-Type': 'application/json'});
      return res.end(JSON.stringify(data));
    }

    // 任务 API（读取）
    if (url === '/api/tasks') {
      const p = path.join(CONFIG.msgDir, '..', 'tasks.md');
      const content = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
      res.writeHead(200, {'Content-Type': 'application/json'});
      return res.end(JSON.stringify({ content }));
    }

    // 任务 API（修改）
    if (req.method === 'POST' && url === '/api/task') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { lineIndex, newContent, newStatus } = JSON.parse(body);
          const p = path.join(CONFIG.msgDir, '..', 'tasks.md');
          if (!fs.existsSync(p)) {
            res.writeHead(200, {'Content-Type': 'application/json'});
            return res.end(JSON.stringify({ success: false, error: 'tasks.md not found' }));
          }
          
          const allLines = fs.readFileSync(p, 'utf8').split('\n');
          
          // 找出所有任务行的真实行号
          const taskLineIndexes = [];
          allLines.forEach((line, idx) => {
            if (line.match(/^-\s*\[[ x~]\]/)) {
              taskLineIndexes.push(idx);
            }
          });
          
          // 用前端传来的 lineIndex 找到真实行号
          if (lineIndex < 0 || lineIndex >= taskLineIndexes.length) {
            res.writeHead(200, {'Content-Type': 'application/json'});
            return res.end(JSON.stringify({ success: false, error: 'Invalid task index' }));
          }
          
          const realLineIndex = taskLineIndexes[lineIndex];
          const line = allLines[realLineIndex];
          
          // 根据请求修改行
          if (newStatus !== undefined) {
            // 切换状态
            allLines[realLineIndex] = line.replace(/^(- \[)[ x~](\])/, '$1' + newStatus + '$2');
          }
          
          if (newContent !== undefined) {
            if (newContent === '') {
              // 删除任务
              allLines[realLineIndex] = '';
            } else {
              // 修改内容
              allLines[realLineIndex] = line.replace(/^(- \[[ x~]\]\s*).*/, '$1' + newContent);
            }
          }
          
          fs.writeFileSync(p, allLines.filter(l => l !== '').join('\n'));
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // 讨论 API
    if (url === '/api/discussions') {
      const discDir = path.join(CONFIG.msgDir, '..', 'discussions');
      if (!fs.existsSync(discDir)) return res.end('[]');
      const files = fs.readdirSync(discDir).filter(f => f.endsWith('.md')).sort().reverse();
      const list = files.slice(0, 15).map(f => {
        const content = fs.readFileSync(path.join(discDir, f), 'utf8');
        const title = (content.match(/^#\s+(.+)$/m) || [])[1] || f;
        return { filename: f, title, date: f.slice(0,10) };
      });
      res.writeHead(200, {'Content-Type': 'application/json'});
      return res.end(JSON.stringify(list));
    }

    // 讨论详情 API
    if (url.startsWith('/api/discussion?')) {
      const fileName = new URLSearchParams(url.split('?')[1]).get('file');
      const filePath = path.join(CONFIG.msgDir, '..', 'discussions', fileName);
      const text = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, {'Content-Type': 'text/plain;charset=utf-8'});
      return res.end(text);
    }

    // 死信队列 API
    if (url === '/api/dead-letters') {
      try {
        const files = fs.readdirSync(deadLetterDir).filter(f => f.endsWith('.json')).sort().reverse();
        const list = files.map(f => {
          const content = JSON.parse(fs.readFileSync(path.join(deadLetterDir, f), 'utf8'));
          return { filename: f, id: content.id, from: content.from, to: content.to, content: content.content, error: content.error, failedAt: content.failedAt };
        });
        res.writeHead(200, {'Content-Type': 'application/json'});
        return res.end(JSON.stringify(list));
      } catch(e) {
        res.writeHead(200, {'Content-Type': 'application/json'});
        return res.end('[]');
      }
    }

    // 重发死信
    if (url.startsWith('/api/dead-letter/resend?')) {
      const filename = new URLSearchParams(url.split('?')[1]).get('file');
      if (!filename) return res.end(JSON.stringify({ error: '缺少文件名' }));
      try {
        const filePath = path.join(deadLetterDir, filename);
        if (!fs.existsSync(filePath)) return res.end(JSON.stringify({ error: '文件不存在' }));
        const msg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const newMsg = { id: String(Date.now()), type: msg.type || 'task', from: msg.from || 'system', to: msg.to || ['wisp'], content: msg.content, timestamp: new Date().toISOString() };
        fs.writeFileSync(path.join(CONFIG.msgDir, newMsg.id + '.json'), JSON.stringify(newMsg, null, 2));
        fs.unlinkSync(filePath);
        return res.end(JSON.stringify({ success: true }));
      } catch(e) { return res.end(JSON.stringify({ error: e.message })); }
    }

    // 删除死信
    if (url.startsWith('/api/dead-letter/delete?')) {
      const filename = new URLSearchParams(url.split('?')[1]).get('file');
      if (!filename) return res.end(JSON.stringify({ error: '缺少文件名' }));
      try {
        const filePath = path.join(deadLetterDir, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          return res.end(JSON.stringify({ success: true }));
        }
        return res.end(JSON.stringify({ error: '文件不存在' }));
      } catch(e) { return res.end(JSON.stringify({ error: e.message })); }
    }
  } catch(e) { res.end('[]'); }
});

// ==================== 6. 消息监听 ====================
async function wakeAgent(name, config, msg, msgId) {
  const task = '【新任务】来自 ' + msg.from + ': ' + msg.content;
  const processedBy = msg.processedBy || [];
  if (processedBy.includes(name)) return;
  
  for (let i = 1; i <= CONFIG.maxRetries; i++) {
    try {
      log('INFO', '正在尝试唤醒 ' + name + ' (' + i + '/' + CONFIG.maxRetries + ')...');
      const safeTask = task.replace(/'/g, "''");
      const cmd = "powershell -ExecutionPolicy Bypass -Command \"& '" + CONFIG.openclawPath + "' system event --text '" + safeTask + "' --mode now --expect-final --url ws://127.0.0.1:" + config.port + " --token " + CONFIG.token + "\"";
      await execPromise(cmd, { timeout: CONFIG.timeout });
      if (!msg.processedBy) msg.processedBy = [];
      if (!msg.processedBy.includes(name)) msg.processedBy.push(name);
      markMessageProcessed(msg, name, true);
      return log('INFO', '✅ ' + name + ' 响应成功');
    } catch(e) {
      log('ERROR', '❌ ' + name + ' 唤醒失败: ' + e.message);
      if (i < CONFIG.maxRetries) await sleep(3000);
    }
  }
  markMessageProcessed(msg, name, false);
  saveToDeadLetter(msg, '唤醒失败');
}

const watcher = chokidar.watch(CONFIG.msgDir + '/*.json', { 
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 }
});
watcher.on('add', async (p) => {
  const fileName = path.basename(p);
  const raw = fs.readFileSync(p, 'utf8');
  const msg = JSON.parse(raw.replace(/^\uFEFF/, ''));
  const msgId = String(msg.id || fileName);
  
  try {
    if (msg.type === 'system') return;
    const targets = (msg.to && msg.to.length) ? msg.to.filter(t => CONFIG.agents[t.toLowerCase()]) : Object.keys(CONFIG.agents);
    targets.forEach(t => wakeAgent(t.toLowerCase(), CONFIG.agents[t.toLowerCase()], msg, msgId));
  } catch(e) {}
});

// ==================== 7. 启动 ====================
server.listen(PORT, () => {
  log('INFO', '================================================');
  log('INFO', '🚀 协作平台已启动: http://localhost:' + PORT);
  log('INFO', '================================================');
});
