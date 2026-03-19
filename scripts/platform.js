/**
 * 任务协作平台 - 全功能优化闭环版
 * * 包含：
 * 1. 前端：Flex 布局精调（对齐截图中的任务行）、中文界面、长文本弹窗。
 * 2. API：支持 消息、任务(tasks.md)、讨论(discussions/)、通知(notifications.json)。
 * 3. 核心：异步非阻塞唤醒逻辑 (exec + retry)，防止服务器卡死。
 * 4. 监听：Chokidar 实时监测新消息并触发 AI。
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

// 日志设置
const LOG_DIR = CONFIG.logDir;
const LOG_FILE = path.join(LOG_DIR, CONFIG.logFile);
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function log(level, msg) {
  const time = new Date().toISOString();
  const line = `[${time}] [${level}] ${msg}`;
  process.stdout.write(line + '\n');
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (e) {}
}

// ==================== 2. 前端 HTML (UI 精调版) ====================
const HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>任务协作平台</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "Segoe UI", "Microsoft YaHei", sans-serif; background: #f0f2f5; color: #1e293b; }
    header { background: #1e293b; color: white; padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; }
    .tabs { background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; padding: 0 1rem; sticky; top: 0; z-index: 100; }
    .tab { padding: 1rem 1.25rem; border: none; background: none; cursor: pointer; color: #64748b; border-bottom: 3px solid transparent; font-size: 0.95rem; }
    .tab:hover { color: #3b82f6; background: #f8fafc; }
    .tab.active { color: #3b82f6; border-bottom-color: #3b82f6; font-weight: bold; }
    
    main { padding: 1.5rem; max-width: 1000px; margin: 0 auto; }
    .panel { background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.05); display: none; min-height: 450px; }
    .panel.active { display: block; }
    
    /* 任务对齐魔法 */
    .task-row { display: flex; align-items: center; gap: 15px; padding: 12px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.2s; }
    .task-row:hover { background: #f8fafc; }
    .task-checkbox { width: 18px; height: 18px; cursor: pointer; flex-shrink: 0; }
    .task-main { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .task-title { font-size: 0.95rem; flex: 1; word-break: break-all; }
    .task-done { text-decoration: line-through; color: #94a3b8; }
    
    .task-badges { display: flex; gap: 8px; flex-shrink: 0; align-items: center; }
    .badge { padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
    .badge-owner { background: #e0f2fe; color: #0284c7; }
    .badge-priority { background: #fee2e2; color: #ef4444; border: 1px solid #fecaca; }
    .badge-priority.low { background: #f1f5f9; color: #64748b; border: none; }

    /* 消息卡片 */
    .card { padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 0.75rem; cursor: pointer; }
    .card:hover { border-color: #3b82f6; background: #f8fbff; }

    /* 弹窗 */
    .modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: none; align-items: center; justify-content: center; z-index: 1000; padding: 20px; backdrop-filter: blur(4px); }
    .modal-content { background: white; width: 100%; max-width: 600px; border-radius: 12px; padding: 24px; max-height: 85vh; overflow-y: auto; position: relative; }
    .detail-box { background: #f8fafc; padding: 20px; border-radius: 8px; white-space: pre-wrap; line-height: 1.8; border: 1px solid #e2e8f0; margin-top: 15px; font-family: monospace; }
    .close-btn { float: right; cursor: pointer; font-size: 1.5rem; color: #64748b; border: none; background: #f1f5f9; width: 32px; height: 32px; border-radius: 50%; }
  </style>
</head>
<body>
  <header><h1>任务协作平台</h1><div id="updateTime" style="font-size:0.8rem"></div></header>
  
  <nav class="tabs">
    <button class="tab active" onclick="switchTab('status', event)">运行状态</button>
    <button class="tab" onclick="switchTab('messages', event)">消息流</button>
    <button class="tab" onclick="switchTab('tasks', event)">任务板</button>
    <button class="tab" onclick="switchTab('discussions', event)">讨论存档</button>
    <button class="tab" onclick="switchTab('notifications', event)">系统通知</button>
  </nav>

  <main>
    <div id="status" class="panel active"><h2>🛸 AI 运行节点</h2><div id="nodeList"></div></div>
    <div id="messages" class="panel"><h2>💬 最近消息流</h2><div id="messageList"></div></div>
    <div id="tasks" class="panel"><h2>📋 团队任务看板</h2><div id="taskList"></div></div>
    <div id="discussions" class="panel"><h2>💭 深度讨论记录</h2><div id="discussionList"></div></div>
    <div id="notifications" class="panel"><h2>🔔 系统实时通知</h2><div id="notificationList"></div></div>
  </main>

  <div id="modal" class="modal" onclick="closeModal()">
    <div class="modal-content" onclick="event.stopPropagation()">
      <button class="close-btn" onclick="closeModal()">×</button>
      <h3 id="modalTitle">详情</h3>
      <div id="modalBody" class="detail-box"></div>
    </div>
  </div>

  <script>
    function escape(str) { return String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
    window.switchTab = (id, e) => {
      document.querySelectorAll('.panel, .tab').forEach(el => el.classList.remove('active'));
      document.getElementById(id).classList.add('active');
      e.currentTarget.classList.add('active');
    };
    window.closeModal = () => document.getElementById('modal').style.display = 'none';

    // 1. 节点状态
    const nodes = [{n:'Wisp',p:18789},{n:'Spark',p:19000},{n:'Cipher',p:19100},{n:'Nexus',p:19200},{n:'Pulse',p:19300},{n:'Flux',p:19400},{n:'Nova',p:19500}];
    function refreshStatus() {
      document.getElementById('nodeList').innerHTML = nodes.map(node => \`
        <div style="display:flex; align-items:center; gap:12px; padding:12px; background:#f8fafc; border-radius:8px; margin-bottom:8px">
          <div style="width:12px; height:12px; border-radius:50%; background:#94a3b8" id="dot-\${node.p}"></div>
          <strong>\${node.n}</strong> <span style="color:#64748b; font-size:0.8rem">端口: \${node.p}</span>
        </div>\`).join('');
      nodes.forEach(node => {
        fetch('http://127.0.0.1:'+node.p+'/', {mode:'no-cors', cache:'no-store'})
          .then(() => document.getElementById('dot-'+node.p).style.background = '#22c55e')
          .catch(() => document.getElementById('dot-'+node.p).style.background = '#ef4444');
      });
      document.getElementById('updateTime').innerText = '最后同步: ' + new Date().toLocaleTimeString();
    }

    // 2. 消息流
    let _msgs = [];
    function loadMessages() {
      fetch('/api/messages').then(r => r.json()).then(data => {
        _msgs = data;
        document.getElementById('messageList').innerHTML = data.map(m => \`
          <div class="card" onclick="viewMsg(\${m.id})">
            <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:5px">
              <strong>👤 \${escape(m.from)}</strong> <span style="color:#8b5cf6">→ \${escape((m.to||['所有人']).join(','))}</span>
            </div>
            <div style="color:#475569; font-size:0.9rem">\${escape(m.content.slice(0,100))}...</div>
          </div>\`).join('');
      });
    }
    window.viewMsg = (id) => {
      const m = _msgs.find(x => x.id == id);
      if(!m) return;
      document.getElementById('modalTitle').innerText = '💬 消息详情';
      document.getElementById('modalBody').innerText = \`【来自】：\${m.from}\\n【发往】：\${(m.to||[]).join(', ')}\\n\\n【内容】：\\n\${m.content}\`;
      document.getElementById('modal').style.display = 'flex';
    };

    // 3. 任务板 (对齐截图优化)
    let _taskData = [];
    function loadTasks() {
      fetch('/api/tasks').then(r => r.json()).then(data => {
        const lines = (data.content || '').split('\\n');
        _taskData = lines.filter(l => l.trim().startsWith('- [')).map(line => {
          const m = line.match(/^-\\s*\\[([ x])\\]\\s*(.+?)(?:\\s*负责人:\\s*(\\w+))?(?:\\s*优先级:\\s*(\\w+))?$/);
          return m ? { done: m[1]==='x', title: m[2].trim(), owner: m[3], priority: m[4], raw: line } : null;
        }).filter(x => x);

        document.getElementById('taskList').innerHTML = _taskData.map((t, idx) => \`
          <div class="task-row" onclick="viewTask(\${idx})">
            <input type="checkbox" class="task-checkbox" \${t.done?'checked':''} disabled>
            <div class="task-main">
              <span class="task-title \${t.done?'task-done':''}">\${escape(t.title)}</span>
              <div class="task-badges">
                \${t.owner ? '<span class="badge badge-owner">👤 '+escape(t.owner)+'</span>' : ''}
                \${t.priority ? '<span class="badge badge-priority '+ (t.priority==='低'?'low':'') +'">🔥 '+escape(t.priority)+'</span>' : ''}
              </div>
            </div>
          </div>\`).join('');
      });
    }
    window.viewTask = (idx) => {
      const t = _taskData[idx];
      document.getElementById('modalTitle').innerText = '📋 任务详情';
      document.getElementById('modalBody').innerText = \`【当前状态】：\${t.done ? '已完成' : '进行中'}\\n【任务标题】：\${t.title}\\n【负 责 人】：\${t.owner || '未指定'}\\n【优 先 级】：\${t.priority || '普通'}\`;
      document.getElementById('modal').style.display = 'flex';
    };

    // 4. 讨论存档
    function loadDiscussions() {
      fetch('/api/discussions').then(r => r.json()).then(data => {
        document.getElementById('discussionList').innerHTML = data.map(d => \`
          <div class="card" onclick="viewDisc('\${d.filename}')">
            <strong>📁 \${escape(d.title)}</strong>
            <div style="font-size:0.75rem; color:#94a3b8; margin-top:5px">存档日期: \${d.date}</div>
          </div>\`).join('');
      });
    }
    window.viewDisc = (file) => {
      fetch('/api/discussion?file=' + encodeURIComponent(file)).then(r => r.text()).then(text => {
        document.getElementById('modalTitle').innerText = '💭 讨论正文';
        document.getElementById('modalBody').innerText = text;
        document.getElementById('modal').style.display = 'flex';
      });
    };

    // 5. 通知
    function loadNotifications() {
      fetch('/api/notifications').then(r => r.json()).then(data => {
        const list = data.notifications || [];
        document.getElementById('notificationList').innerHTML = list.map(n => \`
          <div style="background:#fffbeb; border-left:4px solid #f59e0b; padding:12px; margin-bottom:10px; border-radius:4px">
            <div>\${escape(n.content || n.message)}</div>
            <div style="font-size:0.7rem; color:#94a3b8; margin-top:5px">\${new Date(n.timestamp||n.time).toLocaleString()}</div>
          </div>\`).join('');
      });
    }

    // 轮询
    refreshStatus(); setInterval(refreshStatus, 5000);
    loadMessages(); setInterval(loadMessages, 5000);
    loadTasks(); setInterval(loadTasks, 5000);
    loadDiscussions(); loadNotifications();
    setInterval(loadNotifications, 30000);
  </script>
</body>
</html>`;

// ==================== 3. 后端 API 与 唤醒核心 ====================
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = req.url;

  if (url === '/' || url === '/index.html') {
    res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
    return res.end(HTML);
  }

  // API 路由逻辑
  try {
    if (url === '/api/messages') {
      const files = fs.readdirSync(CONFIG.msgDir).filter(f => f.endsWith('.json') && f !== 'counter.json').sort().slice(-20);
      const data = files.map(f => JSON.parse(fs.readFileSync(path.join(CONFIG.msgDir, f), 'utf8')));
      res.writeHead(200, {'Content-Type': 'application/json'});
      return res.end(JSON.stringify(data));
    }

    if (url === '/api/tasks') {
      const p = path.join(CONFIG.msgDir, '..', 'tasks.md');
      const content = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
      res.writeHead(200, {'Content-Type': 'application/json'});
      return res.end(JSON.stringify({ content }));
    }

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

    if (url.startsWith('/api/discussion?')) {
      const fileName = new URLSearchParams(url.split('?')[1]).get('file');
      const filePath = path.join(CONFIG.msgDir, '..', 'discussions', fileName);
      const text = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, {'Content-Type': 'text/plain;charset=utf-8'});
      return res.end(text);
    }

    if (url === '/api/notifications') {
      const p = path.join(CONFIG.msgDir, '..', 'notifications.json');
      const data = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '{"notifications":[]}';
      res.writeHead(200, {'Content-Type': 'application/json'});
      return res.end(data);
    }
  } catch (e) { res.end('[]'); }
});

// ==================== 4. 自动唤醒监听器 (核心逻辑) ====================
const processedFiles = new Set();

async function wakeAgent(name, config, msg) {
  const task = `【新任务】来自 ${msg.from}: ${msg.content}`;
  for (let i = 1; i <= CONFIG.maxRetries; i++) {
    try {
      log('INFO', `正在尝试唤醒 ${name} (${i}/${CONFIG.maxRetries})...`);
      // 异步执行 PowerShell 脚本，不阻塞 HTTP 响应
      await execPromise(`powershell -ExecutionPolicy Bypass -File "${CONFIG.openclawPath}" system event --text "${task}" --mode now --expect-final --url "ws://127.0.0.1:${config.port}" --token ${CONFIG.token}`, { timeout: CONFIG.timeout });
      return log('INFO', `✅ ${name} 响应成功`);
    } catch (e) {
      log('ERROR', `❌ ${name} 唤醒失败: ${e.message}`);
      if (i < CONFIG.maxRetries) await sleep(3000); // 异步等待
    }
  }
}

const watcher = chokidar.watch(CONFIG.msgDir + '/*.json', { 
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 }
});
watcher.on('add', async (p) => {
  const fileName = path.basename(p);
  
  // 去重：基于文件名 + 内容 hash
  const raw = fs.readFileSync(p, 'utf8');
  const msg = JSON.parse(raw.replace(/^\uFEFF/, ''));
  const msgKey = msg.id || fileName;
  
  if (processedFiles.has(msgKey)) return;
  processedFiles.add(msgKey);
  
  try {
    if (msg.type === 'system') return;
    
    // 决定谁来干活
    const targets = (msg.to && msg.to.length) ? msg.to.filter(t => CONFIG.agents[t.toLowerCase()]) : Object.keys(CONFIG.agents);
    
    targets.forEach(t => {
      wakeAgent(t.toLowerCase(), CONFIG.agents[t.toLowerCase()], msg);
    });
  } catch(e) {}
});

server.listen(PORT, () => {
  log('INFO', '================================================');
  log('INFO', `🚀 协作平台完全体已启动: http://localhost:${PORT}`);
  log('INFO', '================================================');
});