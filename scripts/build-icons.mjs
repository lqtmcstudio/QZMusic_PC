/**
 * 生成本地离线图标数据 src/renderer/src/assets/icons.json
 *
 * 扫描 src/renderer 源码中引用的 Iconify 图标（前缀:名称 形式），
 * 从 node_modules/@iconify-json/* 离线数据包中提取对应图标，
 * 生成精简后的 JSON，由 src/renderer/src/iconifyOffline.ts 在启动时
 * 通过 addCollection 注册，使 <Icon> 组件完全离线工作。
 *
 * 新增图标引用后重新运行本脚本即可（dev/build 前会自动执行）；
 * 若引用了未安装数据包的图标集，脚本会报错并提示安装对应的 @iconify-json/* 包。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, 'src', 'renderer')
const outPath = path.join(root, 'src', 'renderer', 'src', 'assets', 'icons.json')
const iconifyJsonDir = path.join(root, 'node_modules', '@iconify-json')

const scanExtensions = new Set(['.vue', '.ts', '.tsx', '.js', '.html', '.css', '.scss'])

function collectFiles(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      files.push(...collectFiles(p))
    } else if (scanExtensions.has(path.extname(entry.name))) {
      files.push(p)
    }
  }
  return files
}

// 已安装的图标集前缀，只有命中前缀的 字符串 才被视为图标引用
const availablePrefixes = fs.existsSync(iconifyJsonDir)
  ? fs.readdirSync(iconifyJsonDir).filter((d) => fs.existsSync(path.join(iconifyJsonDir, d, 'icons.json')))
  : []
if (availablePrefixes.length === 0) {
  console.error('[icons] 未找到 @iconify-json/* 数据包，请先安装，例如：npm i -D @iconify-json/lucide')
  process.exit(1)
}

// 收集源码中引用的图标名，按前缀分组
const used = new Map() // prefix -> Set<name>
for (const file of collectFiles(srcDir)) {
  const content = fs.readFileSync(file, 'utf8')
  const re = /([a-z][a-z0-9]*):([a-z][a-z0-9-]*)/g
  let m
  while ((m = re.exec(content))) {
    const [prefix, name] = [m[1], m[2]]
    if (availablePrefixes.includes(prefix)) {
      if (!used.has(prefix)) used.set(prefix, new Set())
      used.get(prefix).add(name)
    }
  }
}
if (used.size === 0) {
  console.error('[icons] 源码中未发现任何图标引用，请确认前缀是否在 @iconify-json/* 中')
  process.exit(1)
}

// 提取图标数据：解析别名链，把别名展开为完整图标
function resolveIcon(collection, name, seen = new Set()) {
  if (seen.has(name)) return null
  seen.add(name)
  if (collection.icons[name]) return { ...collection.icons[name] }
  const alias = collection.aliases?.[name]
  if (!alias) return null
  const parent = resolveIcon(collection, alias.parent, seen)
  if (!parent) return null
  const resolved = { ...parent }
  for (const key of ['body', 'width', 'height', 'left', 'top', 'transform', 'hidden']) {
    if (alias[key] !== undefined) resolved[key] = alias[key]
  }
  delete resolved.hidden
  return resolved
}

const output = {}
let total = 0
for (const [prefix, names] of [...used.entries()].sort()) {
  const raw = JSON.parse(fs.readFileSync(path.join(iconifyJsonDir, prefix, 'icons.json'), 'utf8'))
  const icons = {}
  const missing = []
  for (const name of [...names].sort()) {
    const data = resolveIcon(raw, name)
    if (data) {
      icons[name] = data
    } else {
      missing.push(name)
    }
  }
  if (missing.length) {
    console.error(`[icons] 图标集 "${prefix}" 中不存在: ${missing.join(', ')}（请检查图标名拼写）`)
    process.exit(1)
  }
  const collection = { prefix, icons }
  for (const key of ['width', 'height', 'left', 'top']) {
    if (raw[key] !== undefined) collection[key] = raw[key]
  }
  output[prefix] = collection
  total += Object.keys(icons).length
  console.log(`[icons] ${prefix}: ${Object.keys(icons).length} 个图标`)
}

fs.writeFileSync(outPath, JSON.stringify(output))
console.log(`[icons] 共 ${total} 个图标 / ${Object.keys(output).length} 个图标集 -> ${path.relative(root, outPath)}`)
