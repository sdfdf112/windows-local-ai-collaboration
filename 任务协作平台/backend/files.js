/**
 * 文件读写封装
 * 统一管理 messages、tasks、discussions 的读写
 */

import fs from 'fs/promises'
import path from 'path'

const DATA_DIR = 'E:\\\\ClawCommunication'

// 读取消息
export async function readMessages(lastReadId = '000') {
  const msgDir = path.join(DATA_DIR, 'messages')
  try {
    const files = await fs.readdir(msgDir)
    const messages = []
    
    for (const file of files) {
      if (file.endsWith('.json') && file !== 'counter.json') {
        const id = file.replace('.json', '')
        if (id > lastReadId) {
          const content = await fs.readFile(path.join(msgDir, file), 'utf-8')
          messages.push(JSON.parse(content))
        }
      }
    }
    
    return messages.sort((a, b) => a.id.localeCompare(b.id))
  } catch {
    return []
  }
}

// 读取任务清单
export async function readTasks() {
  const taskFile = path.join(DATA_DIR, 'tasks.md')
  try {
    return await fs.readFile(taskFile, 'utf-8')
  } catch {
    return '## 📋 任务清单\n\n'
  }
}

// 写入任务清单
export async function writeTasks(content) {
  const taskFile = path.join(DATA_DIR, 'tasks.md')
  await fs.writeFile(taskFile, content, 'utf-8')
}

// 读取设置
export async function readSettings() {
  const settingsFile = path.join(DATA_DIR, 'settings.json')
  try {
    const content = await fs.readFile(settingsFile, 'utf-8')
    return JSON.parse(content)
  } catch {
    return { nodeName: 'wisp', heartbeatInterval: 3000 }
  }
}

// 写入设置
export async function writeSettings(settings) {
  const settingsFile = path.join(DATA_DIR, 'settings.json')
  await fs.writeFile(settingsFile, JSON.stringify(settings, null, 2))
}

// 读取讨论记录
export async function readDiscussions() {
  const discDir = path.join(DATA_DIR, 'discussions')
  try {
    const files = await fs.readdir(discDir)
    const discussions = []
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        const content = await fs.readFile(path.join(discDir, file), 'utf-8')
        discussions.push({ file, content })
      }
    }
    
    return discussions.sort((a, b) => b.file.localeCompare(a.file))
  } catch {
    return []
  }
}

// 保存讨论记录
export async function saveDiscussion(date, content) {
  const discFile = path.join(DATA_DIR, 'discussions', `${date}.md`)
  await fs.writeFile(discFile, content, 'utf-8')
}
