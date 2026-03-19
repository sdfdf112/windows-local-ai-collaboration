<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// API 服务地址
const API_BASE = 'http://localhost:3001'

// 当前激活的标签页
const activeTab = ref('status')

// 消息列表
const messages = ref([])
const selectedMessage = ref(null)

// 任务列表
const tasks = ref([])

// 通知列表
const notifications = ref([])

// AI 在线状态 (端口检测)
const aiStatus = ref([
  { name: 'Wisp', port: 18789, online: false },
  { name: 'Spark', port: 19000, online: false },
  { name: 'Cipher', port: 19100, online: false },
  { name: 'Nexus', port: 19200, online: false }
])

// 启动
onMounted(() => {
  // 启动端口检测 (每3秒)
  checkAiStatus()
  setInterval(checkAiStatus, 3000)
  
  // 加载任务和通知
  loadTasksAndNotifications()
})

// 通过 HTTP API 加载数据
async function loadTasksAndNotifications() {
  // 加载消息
  try {
    const response = await fetch(`${API_BASE}/api/messages`)
    messages.value = await response.json()
  } catch (e) {
    console.log('消息加载失败:', e)
  }
  
  // 加载通知
  try {
    const response = await fetch(`${API_BASE}/api/notifications`)
    notifications.value = await response.json()
  } catch (e) {
    console.log('通知加载失败:', e)
  }
  
  // 加载任务
  try {
    const response = await fetch(`${API_BASE}/api/tasks`)
    const data = await response.json()
    if (data.content) {
      parseTasks(data.content)
    }
  } catch (e) {
    console.log('任务加载失败:', e)
  }
}
  
  // 加载通知
  try {
    const response = await fetch(`${API_BASE}/api/notifications`)
    const data = await response.json()
    notifications.value = data || []
  } catch (e) {
    console.log('通知加载失败:', e)
  }
  
  // 加载任务
  try {
    const response = await fetch(`${API_BASE}/api/tasks`)
    const data = await response.json()
    if (data.content) {
      parseTasks(data.content)
    }
  } catch (e) {
    console.log('任务加载失败:', e)
  }
}

// 解析任务
function parseTasks(content) {
  const lines = content.split('\n')
  const result = []
  
  for (const line of lines) {
    const match = line.match(/^-\s*\[([ x~])\]\s*(.+?)(?:\s*-\s*负责人:\s*(\w+))?(?:\s*-\s*优先级:\s*(\w+))?$/)
    if (match) {
      const [, status, text, owner] = match
      result.push({
        id: result.length + 1,
        status: status === 'x' ? 'done' : status === '~' ? 'in_progress' : 'todo',
        text: text.trim(),
        owner: owner || ''
      })
    }
  }
  tasks.value = result
}

// 检测 AI 在线状态 (通过端口)
function checkAiStatus() {
  aiStatus.value.forEach(ai => {
    fetch(`http://127.0.0.1:${ai.port}/`, { mode: 'no-cors' })
      .then(() => { ai.online = true; })
      .catch(() => { ai.online = false; });
  });
}

onUnmounted(() => {
  // 清理
})

// 添加消息到列表
function addMessage(msg) {
  messages.value.push({
    id: msg.id,
    from: msg.from,
    to: msg.to,
    content: msg.content,
    time: new Date(msg.timestamp).toLocaleTimeString()
  })
}

// 查看消息详情
function viewMessage(msg) {
  selectedMessage.value = msg
}

function closeMessage() {
  selectedMessage.value = null
}

// 格式化时间
function getTimeAgo(timestamp) {
  if (!timestamp) return '未知'
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 10) return '刚刚'
  if (seconds < 60) return `${seconds}秒前`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分钟前`
  return `${Math.floor(minutes / 60)}小时前`
}

function getStatusColor(status) {
  return status === 'online' ? '#4ade80' : '#9ca3af'
}
</script>

<template>
  <div class="app">
    <header>
      <h1>🦞 任务协作平台</h1>
    </header>
    
    <nav class="tabs">
      <button 
        :class="['tab', activeTab === 'status' && 'active']"
        @click="activeTab = 'status'"
      >
        🦞 状态
      </button>
      <button 
        :class="['tab', activeTab === 'messages' && 'active']"
        @click="activeTab = 'messages'"
      >
        💬 消息
      </button>
      <button 
        :class="['tab', activeTab === 'tasks' && 'active']"
        @click="activeTab = 'tasks'"
      >
        ✅ 任务
      </button>
      <button 
        :class="['tab', activeTab === 'discussions' && 'active']"
        @click="activeTab = 'discussions'"
      >
        📝 讨论
      </button>
      <button 
        :class="['tab', activeTab === 'notifications' && 'active']"
        @click="activeTab = 'notifications'"
      >
        🔔 通知
        <span v-if="notifications.filter(n => !n.read).length" class="badge">
          {{ notifications.filter(n => !n.read).length }}
        </span>
      </button>
      <button 
        :class="['tab', activeTab === 'settings' && 'active']"
        @click="activeTab = 'settings'"
      >
        ⚙️ 设置
      </button>
    </nav>
    
    <main>
      <!-- 状态大屏 -->
      <div v-if="activeTab === 'status'" class="panel">
        <h2>🛸 AI 状态 (Gateway 端口检测)</h2>
        <div class="node-list">
          <div v-for="ai in aiStatus" :key="ai.name" class="node-card">
            <span class="node-status" :style="{ background: ai.online ? '#4ade80' : '#9ca3af' }"></span>
            <span class="node-name">{{ ai.name }}</span>
            <span class="node-time">{{ ai.online ? '在线' : '离线' }}</span>
            <span class="node-port">{{ ai.port }}</span>
          </div>
        </div>
      </div>
      
      <!-- 消息 -->
      <div v-if="activeTab === 'messages'" class="panel">
        <h2>💬 消息 (messages/)</h2>
        <div class="message-list">
          <div 
            v-for="msg in messages" 
            :key="msg.id" 
            class="message-card"
            @click="viewMessage(msg)"
          >
            <div class="msg-card-header">
              <span class="msg-from">{{ msg.from }}</span>
              <span v-if="msg.to && msg.to.length > 0" class="msg-to">→ {{ msg.to.join(', ') }}</span>
              <span class="msg-id">#{{ msg.id }}</span>
            </div>
            <div class="msg-card-content">{{ msg.content }}</div>
            <div class="msg-card-footer">
              <span class="msg-time">{{ new Date(msg.timestamp).toLocaleString() }}</span>
              <span class="msg-click">点击查看详情 →</span>
            </div>
          </div>
          <div v-if="messages.length === 0" class="empty">
            暂无消息。消息通过 messages/ 目录文件传递。
          </div>
        </div>
        
        <!-- 消息详情弹窗 -->
        <div v-if="selectedMessage" class="modal-overlay" @click="closeMessage">
          <div class="modal-content" @click.stop>
            <div class="modal-header">
              <h3>消息详情 #{{ selectedMessage.id }}</h3>
              <button class="modal-close" @click="closeMessage">×</button>
            </div>
            <div class="modal-body">
              <div class="detail-row">
                <span class="label">发送者:</span>
                <span class="value">{{ selectedMessage.from }}</span>
              </div>
              <div class="detail-row">
                <span class="label">接收者:</span>
                <span class="value">{{ selectedMessage.to?.join(', ') || '所有人' }}</span>
              </div>
              <div class="detail-row">
                <span class="label">时间:</span>
                <span class="value">{{ new Date(selectedMessage.timestamp).toLocaleString() }}</span>
              </div>
              <div class="detail-row">
                <span class="label">类型:</span>
                <span class="value">{{ selectedMessage.type || '普通' }}</span>
              </div>
              <div class="detail-content">
                <span class="label">内容:</span>
                <div class="content-box">{{ selectedMessage.content }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 任务 -->
      <div v-if="activeTab === 'tasks'" class="panel">
        <h2>📋 任务</h2>
        <div class="task-list">
          <div v-for="task in tasks" :key="task.id" class="task-item">
            <input type="checkbox" :checked="task.status === 'done'" disabled />
            <span :class="['task-text', task.status === 'done' && 'done']">{{ task.text }}</span>
            <span class="task-owner">{{ task.owner }}</span>
          </div>
        </div>
        <div v-if="tasks.length === 0" class="empty">
          暂无任务
        </div>
      </div>
      
      <!-- 讨论 -->
      <div v-if="activeTab === 'discussions'" class="panel">
        <h2>📝 讨论记录</h2>
        <p class="placeholder">等待开发...</p>
      </div>
      
      <!-- 通知 -->
      <div v-if="activeTab === 'notifications'" class="panel">
        <h2>🔔 通知中心</h2>
        <div class="notification-list">
          <div 
            v-for="notif in notifications" 
            :key="notif.id" 
            :class="['notification-item', !notif.read && 'unread']"
          >
            <span class="notif-icon">
              {{ notif.type === 'task' ? '✅' : notif.type === 'message' ? '💬' : 'ℹ️' }}
            </span>
            <div class="notif-content">
              <span class="notif-title">{{ notif.title }}</span>
              <span class="notif-text">{{ notif.content }}</span>
              <span class="notif-time">{{ notif.timestamp }}</span>
            </div>
          </div>
          <div v-if="notifications.length === 0" class="empty">
            暂无通知
          </div>
        </div>
      </div>
      
      <!-- 设置 -->
      <div v-if="activeTab === 'settings'" class="panel">
        <h2>⚙️ 设置</h2>
        <div class="settings">
          <p>任务协作平台 v2.2</p>
          <p class="desc">消息通过 messages/ 目录文件传递</p>
        </div>
      </div>
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
}
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
header {
  background: #1e293b;
  color: white;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
header h1 {
  font-size: 1.3rem;
  font-weight: 600;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #94a3b8;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.status-dot.online { background: #4ade80; }
.status-dot.offline { background: #ef4444; }
.my-name {
  background: #3b82f6;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  color: white;
}

.tabs {
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  padding: 0 1rem;
}
.tab {
  padding: 0.75rem 1rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.9rem;
  color: #64748b;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.tab:hover { color: #334155; }
.tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}
.tab .badge {
  background: #ef4444;
  color: white;
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 10px;
  margin-left: 0.25rem;
}

main { flex: 1; padding: 1.5rem; }
.panel {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.panel h2 {
  font-size: 1.1rem;
  margin-bottom: 1rem;
  color: #1e293b;
}

.node-list { display: flex; flex-direction: column; gap: 0.75rem; }
.node-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 6px;
}
.node-status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.node-name { font-weight: 500; }
.node-time { color: #94a3b8; font-size: 0.85rem; margin-left: auto; }
.node-port { color: #64748b; font-size: 0.75rem; }

.message-list, .task-list { 
  display: flex; 
  flex-direction: column; 
  gap: 0.75rem; 
  max-height: 500px;
  overflow-y: auto;
  margin-bottom: 1rem;
}
.message-card {
  background: white;
  border-radius: 12px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.message-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  transform: translateY(-2px);
}
.msg-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.msg-card-content {
  color: #475569;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 0.5rem;
}
.msg-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: #94a3b8;
}
.msg-click {
  color: #3b82f6;
  opacity: 0;
  transition: opacity 0.2s;
}
.message-card:hover .msg-click {
  opacity: 1;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}
.modal-header h3 { margin: 0; color: #1e293b; }
.modal-close {
  background: none; border: none; font-size: 1.5rem;
  cursor: pointer; color: #64748b; padding: 0; line-height: 1;
}
.modal-close:hover { color: #1e293b; }
.modal-body { padding: 1.5rem; }
.detail-row {
  display: flex; margin-bottom: 0.75rem;
}
.detail-row .label { width: 60px; color: #64748b; font-size: 0.85rem; }
.detail-row .value { color: #1e293b; font-weight: 500; }
.detail-content .label { display: block; color: #64748b; font-size: 0.85rem; margin-bottom: 0.5rem; }
.content-box {
  background: #f8fafc; padding: 1rem; border-radius: 8px;
  white-space: pre-wrap; word-break: break-word; color: #334155; line-height: 1.6;
}

.task-text { flex: 1; }
.task-text.done { text-decoration: line-through; color: #94a3b8; }
.task-owner { 
  font-size: 0.8rem; 
  background: #e0f2fe; 
  color: #0284c7; 
  padding: 0.2rem 0.5rem; 
  border-radius: 4px; 
}

.empty { text-align: center; color: #94a3b8; padding: 2rem; }
.placeholder { color: #94a3b8; text-align: center; padding: 2rem; }

.message-input {
  display: flex;
  gap: 0.5rem;
}
.target-select {
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}
.message-input input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}
.message-input button {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.message-input button:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

.settings { display: flex; flex-direction: column; gap: 1rem; }
.settings label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.settings input {
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  width: 200px;
}
.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 0.5rem;
}
.btn-primary:hover {
  background: #2563eb;
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.notification-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 6px;
  border-left: 3px solid #e2e8f0;
}
.notification-item.unread {
  background: #f0f9ff;
  border-left-color: #3b82f6;
}
.notif-icon {
  font-size: 1.2rem;
}
.notif-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.notif-title {
  font-weight: 500;
  color: #1e293b;
}
.notif-text {
  font-size: 0.9rem;
  color: #64748b;
}
.notif-time {
  font-size: 0.75rem;
  color: #94a3b8;
}
</style>
