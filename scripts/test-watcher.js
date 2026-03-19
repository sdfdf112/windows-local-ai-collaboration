/**
 * 测试 watcher.js 命令执行 - 询问上下文
 */
const { execSync } = require('child_process');

const openclawPath = 'C:\\Users\\sdfdf112\\AppData\\Local\\fnm_multishells\\10400_1773578706147\\openclaw.ps1';

console.log('测试上下文保持...');

try {
  const result = execSync(
    `powershell -ExecutionPolicy Bypass -File "${openclawPath}" agent --session-id main -m "我刚才让你回复什么？"`,
    { 
      timeout: 60000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }
  );
  console.log('结果:', result);
} catch (err) {
  console.log('错误:', err.message);
}
