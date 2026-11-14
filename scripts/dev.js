// `npm run dev` -> starts the API server (:3001) and the Vite website (:5173) together.
import { spawn } from 'node:child_process'

const run = (name, color, cmd, args) => {
  const p = spawn(cmd, args, { stdio: ['inherit', 'pipe', 'pipe'], shell: process.platform === 'win32' })
  const tag = `\x1b[${color}m[${name}]\x1b[0m `
  const pipe = (stream, out) =>
    stream.on('data', (d) => out.write(d.toString().replace(/^(?=.)/gm, tag)))
  pipe(p.stdout, process.stdout)
  pipe(p.stderr, process.stderr)
  p.on('exit', (code) => {
    console.log(`${tag}exited (${code}), stopping everything`)
    shutdown(code ?? 0)
  })
  return p
}

const procs = [
  run('api', 35, process.execPath, ['--env-file-if-exists=.env', '--watch', 'server/index.js']),
  // extra args go to Vite, e.g. `npm run dev -- --host` to open it from your phone
  run('web', 36, process.execPath, ['node_modules/vite/bin/vite.js', ...process.argv.slice(2)]),
]

let stopping = false
function shutdown(code) {
  if (stopping) return
  stopping = true
  for (const p of procs) p.kill()
  process.exit(code)
}
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
