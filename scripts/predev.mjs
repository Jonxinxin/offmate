/**
 * 启动前检查与清理。
 *
 * 存在的理由：wrangler 的实际运行时是子进程 workerd。wrangler 退出时并不总能
 * 带走它——在 Windows 上尤其常见，正常 Ctrl+C 也可能留下孤儿 workerd 继续占着
 * 端口，但已不再响应请求。
 *
 * 此时 npm run dev 的表现极具迷惑性：Vite 正常启动、页面打得开，只有 API 全部
 * 静默失败，看起来完全像是代码 bug。与其让人去查一个不存在的问题，不如在启动前
 * 把残留清掉。
 *
 * 只清理确认是 workerd 的进程；端口被其他程序占用时不动它，改为报错退出。
 */
import net from 'node:net'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const PORT = 8787
const isWindows = process.platform === 'win32'

// wrangler dev 要求 assets 目录存在，首次开发时还没构建过
fs.mkdirSync('dist', { recursive: true })

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return ''
  }
}

function portInUse() {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', (err) => resolve(err.code === 'EADDRINUSE'))
    server.once('listening', () => server.close(() => resolve(false)))
    server.listen(PORT, '127.0.0.1')
  })
}

/** 返回占用该端口的进程 [{ pid, name }]，识别不出时返回空数组 */
function findHolders() {
  if (isWindows) {
    // 只看 IPv4 回环/全接口：wrangler 绑的是 127.0.0.1，
    // [::1] 上的监听（例如 WSL 的 wslrelay）与它并不冲突，算进来会造成误判。
    const pids = new Set()
    for (const line of run('netstat', ['-ano']).split('\n')) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 5 || parts[3]?.toUpperCase() !== 'LISTENING') continue
      if (parts[1] !== `127.0.0.1:${PORT}` && parts[1] !== `0.0.0.0:${PORT}`) continue
      pids.add(parts[4])
    }

    return [...pids].map((pid) => {
      // CSV + /NH 避免中文 Windows 的表头和列宽干扰解析
      const row = run('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'])
      const name = row.split(',')[0]?.replace(/"/g, '').trim() ?? ''
      return { pid, name }
    })
  }

  const pids = run('lsof', ['-nP', `-iTCP@127.0.0.1:${PORT}`, '-sTCP:LISTEN', '-t'])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

  return pids.map((pid) => ({ pid, name: run('ps', ['-p', pid, '-o', 'comm=']).trim() }))
}

/**
 * 找出本项目遗留的 wrangler / workerd 进程。
 *
 * 必须连 wrangler 一起清：workerd 是被 wrangler 拉起来的，只杀 workerd 的话
 * 父进程会立刻再启一个，端口依旧占着。
 *
 * 用命令行里是否包含本项目路径来限定范围，这样不会误伤你在别处开着的其他
 * wrangler 项目。
 */
function findProjectRuntimeProcesses() {
  const cwd = process.cwd()

  if (isWindows) {
    const script =
      `Get-CimInstance Win32_Process | Where-Object { ` +
      `$_.CommandLine -and ($_.CommandLine -match 'workerd|wrangler') -and ` +
      `$_.CommandLine.Contains('${cwd}') } | ForEach-Object { $_.ProcessId }`

    return run('powershell', ['-NoProfile', '-Command', script])
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  return run('pgrep', ['-f', `${cwd}.*(workerd|wrangler)`])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

function kill(pid) {
  if (isWindows) run('taskkill', ['/F', '/T', '/PID', pid])
  else run('kill', ['-9', pid])
}

if (await portInUse()) {
  const holders = findHolders()
  const foreign = holders.filter((h) => !/workerd|wrangler/i.test(h.name))

  if (foreign.length > 0) {
    const who = foreign.map((h) => `  ${h.pid}  ${h.name}`).join('\n')
    console.error(
      `\n端口 ${PORT} 被其他程序占用，后端无法启动：\n\n${who}\n\n` +
        `请关闭该程序，或改用其他端口：wrangler dev --port <其他端口>\n`,
    )
    process.exit(1)
  }

  const stale = findProjectRuntimeProcesses()
  if (stale.length === 0) {
    console.error(
      `\n端口 ${PORT} 被占用，但没能识别出占用进程。\n` +
        `可以手动清理：taskkill /F /IM workerd.exe（Windows）或 pkill -f workerd\n`,
    )
    process.exit(1)
  }

  stale.forEach(kill)

  // 端口释放不是瞬时的，等一下再放行，否则紧接着启动的 wrangler 仍会撞上
  await new Promise((r) => setTimeout(r, 1500))

  if (await portInUse()) {
    console.error(`\n已尝试清理残留进程，但端口 ${PORT} 仍被占用，请手动检查。\n`)
    process.exit(1)
  }

  console.log(`已清理上次残留的 ${stale.length} 个 wrangler/workerd 进程`)
}
