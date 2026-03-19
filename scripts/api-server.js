/**
 * 消息 HTTP 服务
 * 提供简单的 API 让前端获取消息列表
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const MSG_DIR = 'E:\\ClawCommunication\\messages';

const server = http.createServer(async (req, res) => {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 获取消息列表 API
  if (req.url === '/api/messages') {
    try {
      const files = fs.readdirSync(MSG_DIR)
        .filter(f => f.endsWith('.json') && f !== 'counter.json')
        .sort()
        .slice(-20); // 最近20条
      
      const messages = [];
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(MSG_DIR, file), 'utf8');
          messages.push(JSON.parse(content));
        } catch (e) {}
      }
      
      res.writeHead(200);
      res.end(JSON.stringify(messages));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 获取任务列表 API
  if (req.url === '/api/tasks') {
    try {
      const content = fs.readFileSync('E:\\ClawCommunication\\tasks.md', 'utf8');
      res.writeHead(200);
      res.end(JSON.stringify({ content }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 获取通知列表 API
  if (req.url === '/api/notifications') {
    try {
      const content = fs.readFileSync('E:\\ClawCommunication\\notifications.json', 'utf8');
      const data = JSON.parse(content);
      res.writeHead(200);
      res.end(JSON.stringify(data.notifications || []));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify([]));
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`📡 消息 API 服务启动: http://localhost:${PORT}`);
  console.log(`   - /api/messages     消息列表`);
  console.log(`   - /api/tasks      任务列表`);
  console.log(`   - /api/notifications 通知列表`);
});
