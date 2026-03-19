/**
 * 任务协作平台 - Socket.io 客户端
 * 负责：连接服务器、收发消息、心跳上报
 */

import { io } from 'socket.io-client'

class SocketClient {
  constructor() {
    this.socket = null
    this.nodeName = 'Spark'  // TODO: 从配置读取
    this.listeners = new Map()
    this.connected = false
  }

  // 初始化连接
  connect(url = 'http://localhost:3000') {
    this.socket = io(url, {
      transports: ['websocket', 'polling']
    })

    this.socket.on('connect', () => {
      console.log('🔌 已连接到服务器')
      this.connected = true
      this.register()
    })

    this.socket.on('disconnect', () => {
      console.log('❌ 断开连接')
      this.connected = false
    })

    this.socket.on('connect_error', (err) => {
      console.error('连接错误:', err.message)
    })

    // 节点状态更新
    this.socket.on('nodes:update', (nodes) => {
      this.emit('nodes:update', nodes)
    })

    // 广播消息
    this.socket.on('message:broadcast', (msg) => {
      this.emit('message', msg)
    })

    // 指定消息
    this.socket.on('message:to', (msg) => {
      this.emit('message:to', msg)
    })

    // 文件变化通知
    this.socket.on('file:discussion', (data) => {
      this.emit('file:discussion', data)
    })

    return this
  }

  // 注册节点
  register() {
    if (this.socket && this.connected) {
      this.socket.emit('register', this.nodeName)
      console.log(`📝 已注册为: ${this.nodeName}`)
    }
  }

  // 发送心跳
  heartbeat() {
    if (this.socket && this.connected) {
      this.socket.emit('heartbeat', { timestamp: Date.now() })
    }
  }

  // 发送消息
  sendMessage(content, to = []) {
    if (this.socket && this.connected) {
      const msg = {
        from: this.nodeName,
        to: to,
        content: content
      }
      this.socket.emit('message', msg)
      return true
    }
    return false
  }

  // 事件监听
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }

  // 触发事件
  emit(event, data) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(cb => cb(data))
    }
  }

  // 移除监听
  off(event, callback) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  // 获取连接状态
  isConnected() {
    return this.connected
  }

  // 断开连接
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.connected = false
    }
  }

  // 设置节点名称
  setNodeName(name) {
    this.nodeName = name
    if (this.connected) {
      this.register()
    }
  }
}

// 导出单例
export const socketClient = new SocketClient()

// 自动连接和心跳
let heartbeatInterval = null

export function initSocketClient(nodeName = 'Spark') {
  socketClient.setNodeName(nodeName)
  socketClient.connect()
  
  // 启动心跳 (每3秒)
  heartbeatInterval = setInterval(() => {
    socketClient.heartbeat()
  }, 3000)

  return socketClient
}

export function destroySocketClient() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
  socketClient.disconnect()
}
