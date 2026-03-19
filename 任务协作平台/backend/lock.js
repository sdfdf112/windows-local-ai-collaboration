/**
 * 文件锁机制
 * 防止多实例同时写入导致文件冲突
 */

import fs from 'fs/promises'
import path from 'path'

const DATA_DIR = 'E:\\\\ClawCommunication'
const locks = new Map()

/**
 * 获取文件锁
 * @param {string} filename - 文件名（不含路径）
 * @param {number} timeout - 超时时间（毫秒）
 */
export async function acquireLock(filename, timeout = 5000) {
  const lockFile = path.join(DATA_DIR, `.lock.${filename}`)
  const startTime = Date.now()
  
  while (locks.get(filename)) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`获取锁超时: ${filename}`)
    }
    await new Promise(r => setTimeout(r, 100))
  }
  
  locks.set(filename, true)
  
  try {
    // 检查是否存在旧锁
    try {
      await fs.stat(lockFile)
      // 锁文件存在，等待或强制获取
      if (Date.now() - startTime > timeout) {
        await fs.unlink(lockFile)
      } else {
        locks.delete(filename)
        return acquireLock(filename, timeout - (Date.now() - startTime))
      }
    } catch {
      // 锁文件不存在，创建新锁
    }
    
    await fs.writeFile(lockFile, JSON.stringify({
      pid: process.pid,
      time: Date.now()
    }))
    
    return true
  } catch (err) {
    locks.delete(filename)
    throw err
  }
}

/**
 * 释放文件锁
 * @param {string} filename - 文件名
 */
export async function releaseLock(filename) {
  const lockFile = path.join(DATA_DIR, `.lock.${filename}`)
  locks.delete(filename)
  
  try {
    await fs.unlink(lockFile)
  } catch {
    // 锁文件可能不存在，忽略
  }
}

/**
 * 安全的文件写入（带锁）
 * @param {string} filename - 文件名
 * @param {string} content - 内容
 */
export async function safeWrite(filename, content) {
  await acquireLock(filename)
  try {
    const filePath = path.join(DATA_DIR, filename)
    await fs.writeFile(filePath, content, 'utf-8')
  } finally {
    await releaseLock(filename)
  }
}
