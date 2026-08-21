/**
 * 构建产物样式检查。
 *
 * 动机：Tailwind 类名写错往往不会报错，只是静默失效。真实踩过的例子是
 * `bg-[--color-ink]`——它能通过 typecheck 和 build，Tailwind 也确实生成了规则，
 * 但生成的是：
 *
 *     .bg-\[--color-ink\]{background-color:--color-ink}
 *
 * 属性值是裸的变量名而不是 var(--color-ink)，属于无效 CSS，浏览器直接丢弃该
 * 声明，表现为"按钮没有背景色"。只能靠肉眼在浏览器里发现。
 *
 * 因此这里不去比对类名是否存在（本例中它存在），而是直接检查产物里有没有
 * "值是裸 CSS 变量名"的声明。这个信号零误报，且不依赖具体写法。
 *
 * Tailwind v4 中引用 @theme 颜色应直接用语义类名（bg-ink）；确实需要任意值时
 * 用 bg-(--color-ink) 或 bg-[var(--color-ink)]。
 */
import fs from 'node:fs'
import path from 'node:path'

const CSS_DIR = 'dist/assets'

const cssFile = fs.existsSync(CSS_DIR)
  ? fs.readdirSync(CSS_DIR).find((f) => f.endsWith('.css'))
  : null

if (!cssFile) {
  console.error('找不到构建产物 CSS，请先运行 npm run build')
  process.exit(1)
}

const css = fs.readFileSync(path.join(CSS_DIR, cssFile), 'utf8')

const broken = []

// [^{}]* 保证只匹配到最内层规则块，媒体查询等外层块会被自然跳过
for (const [, selector, body] of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
  for (const decl of body.split(';')) {
    const colon = decl.indexOf(':')
    if (colon < 0) continue

    const prop = decl.slice(0, colon).trim()
    const value = decl.slice(colon + 1).trim()

    // 左侧是自定义属性时，右侧写变量名是合法的（例如 --tw-x:--tw-y）
    if (prop.startsWith('--')) continue
    // 只有"值是一个裸变量名"才是错的；var(--x) 是正确写法
    if (!/^--[\w-]+$/.test(value)) continue

    broken.push({ selector: selector.trim(), prop, value })
  }
}

if (broken.length === 0) {
  console.log('样式检查通过：产物中没有无效的 CSS 变量引用')
  process.exit(0)
}

console.error('\n构建产物中存在无效的 CSS 声明（值是裸变量名，缺少 var()）：\n')
for (const { selector, prop, value } of broken) {
  console.error(`  ${selector}`)
  console.error(`      ${prop}: ${value}    → 应为 ${prop}: var(${value})`)
}
console.error(
  '\n浏览器会直接丢弃这些声明，样式静默失效。\n' +
    'Tailwind v4 中引用 @theme 颜色请用语义类名（如 bg-ink），\n' +
    '而不是 bg-[--color-ink]。\n',
)
process.exit(1)
