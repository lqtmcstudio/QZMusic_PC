// 验证 out/renderer 打包产物中是否包含全部本地图标数据
// 采用与转义无关的比对：去掉所有反斜杠后匹配，避免 JSON 内联转义层级的干扰
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(fs.readFileSync(path.join(root, 'src/renderer/src/assets/icons.json'), 'utf8'))

const outDir = path.join(root, 'out/renderer')
const chunks = []
for (const f of fs.readdirSync(path.join(outDir, 'assets'))) {
  if (f.endsWith('.js')) chunks.push(fs.readFileSync(path.join(outDir, 'assets', f), 'utf8'))
}
const normalize = (s) => s.split('\\').join('')
const bundle = normalize(chunks.join('\n'))

let ok = 0
const missing = []
for (const [prefix, col] of Object.entries(data)) {
  for (const [name, icon] of Object.entries(col.icons)) {
    const seg = normalize(icon.body).slice(20, 60)
    if (seg.length >= 20 && bundle.includes(seg)) ok++
    else missing.push(`${prefix}:${name}`)
  }
}
console.log(`图标数据验证: ${ok} / ${ok + missing.length} 已内联到构建产物`)
if (missing.length) console.log('缺失:', missing.join(', '))
process.exit(missing.length ? 1 : 0)
