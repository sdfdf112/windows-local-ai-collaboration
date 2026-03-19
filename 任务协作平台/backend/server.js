/**
 * 任务协作平台 - Socket.io 后端服务
 * 负责：实时消息传输、节点状态管理、文件监控触发
 */

import { Server } from 'socket.io'
import { readTasks, writeTasks, readMessages } from './files.js'
import { watch } from 'chokidar'
import fs from 'fs/promises'
import path from 'path'

const PORT = 3000
const DATA_DIR = 'E:\\ClawCommunication'

// 节点状态存储
const nodes = new Map()

// 初始化 Socket.io 服务器
const io = new Server(PORT, {
  cors: { origin: '*' }
})

console.log(`🚀 Socket.io 服务器启动: localhost:${PORT}`)

// 监听连接
io.on('connection', (socket) => {
  console.log(`🦞 新连接: ${socket.id}`)

  // 节点注册
  socket.on('register', (nodeName) => {
    nodes.set(socket.id, {
      name: nodeName,
      lastSeen: Date.now(),
      online: true
    })
    console.log(`✅ 节点注册: ${nodeName}`)
    broadcastNodes()
  })

  // 接收心跳
  socket.on('heartbeat', (data) => {
    const node = nodes.get(socket.id)
    if (node) {
      node.lastSeen = Date.now()
      node.online = true
      broadcastNodes()
    }
  })

  // 接收消息
  socket.on('message', async (msg) => {
    await saveMessage(msg)
    // 广播给目标接收者
    if (msg.to && msg.to.length > 0) {
      msg.to.forEach(target => {
        io.emit('message:to', { ...msg, target })
      })
    } else {
      io.emit('message:broadcast', msg)
    }
  })

  // 断开
  socket.on('disconnect', () => {
    const node = nodes.get(socket.id)
    if (node) {
      node.online = false
      console.log(`🔴 节点离线: ${node.name}`)
      broadcastNodes()
    }
    nodes.delete(socket.id)
  })

  // 请求任务列表
  socket.on('tasks:read', async () => {
    const content = await readTasks()
    socket.emit('tasks:data', content)
  })

  // 保存任务列表
  socket.on('tasks:write', async (content) => {
    await writeTasks(content)
    socket.emit('tasks:saved', true)
  })

  // 请求消息列表
  socket.on('messages:read', async (lastReadId) => {
    const messages = await readMessages(lastReadId || '000')
    socket.emit('messages:data', messages)
  })

  // 请求通知列表
  socket.on('notifications:read', async () => {
    const notifFile = path.join(DATA_DIR, 'notifications.json')
    try {
      const content = await fs.readFile(notifFile, 'utf-8')
      const data = JSON.parse(content)
      socket.emit('notifications:data', data.notifications || [])
    } catch {
      socket.emit('notifications:data', [])
    }
  })

  // 标记通知为已读
  socket.on('notifications:markRead', async (notifId) => {
    const notifFile = path.join(DATA_DIR, 'notifications.json')
    try {
      const content = await fs.readFile(notifFile, 'utf-8')
      const data = JSON.parse(content)
      data.notifications = data.notifications.map(n => 
        n.id === notifId ? { ...n, read: true } : n
      )
      await fs.writeFile(notifFile, JSON.stringify(data, null, 2))
    } catch {}
  })
})

// 广播节点状态
function broadcastNodes() {
  const nodeList = Array.from(nodes.entries()).map(([id, node]) => ({
    id,
    ...node,
    lastSeen: undefined,
    status: (Date.now() - node.lastSeen) > 10000 ? 'offline' : 'online'
  }))
  io.emit('nodes:update', nodeList)
}

// 保存消息到文件
async function saveMessage(msg) {
  const msgDir = path.join(DATA_DIR, 'messages')
  await fs.mkdir(msgDir, { recursive: true })
  
  // 读取计数器
  const counterFile = path.join(msgDir, 'counter.json')
  let counter = { id: 0 }
  try {
    const content = await fs.readFile(counterFile, 'utf-8')
    counter = JSON.parse(content)
  } catch {}
  
  counter.id++
  await fs.writeFile(counterFile, JSON.stringify(counter))
  
  // 保存消息
  const msgFile = path.join(msgDir, `${String(counter.id).padStart(3, '0')}.json`)
  await fs.writeFile(msgFile, JSON.stringify({
    ...msg,
    id: String(counter.id).padStart(3, '0'),
    timestamp: new Date().toISOString()
  }, null, 2))
}

// 文件监控 - 监听讨论文件夹
const discussionsWatch = watch(path.join(DATA_DIR, 'discussions'), {
  persistent: true
})

discussionsWatch.on('add', (filePath) => {
  console.log(`📝 新讨论文件: ${path.basename(filePath)}`)
  io.emit('file:discussion', { type: 'add', file: path.basename(filePath) })
})

// 定时检查节点在线状态
setInterval(() => {
  let changed = false
  nodes.forEach((node) => {
    if (node.online && (Date.now() - node.lastSeen) > 10000) {
      node.online = false
      changed = true
    }
  })
  if (changed) broadcastNodes()
}, 5000)

export { io }
