import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { describe, expect, it } from 'vitest'

const RENDERER_ROOT = join(import.meta.dirname, '..')

/** Ant Design 6 已知弃用 API — 命中即测试失败 */
const DEPRECATED_PATTERNS: Array<{ pattern: RegExp; hint: string }> = [
  { pattern: /\bSpin[^>]*\btip=/, hint: 'Spin: tip → description' },
  { pattern: /\bdestroyOnClose\b/, hint: 'Modal/Drawer: destroyOnClose → destroyOnHidden' },
  { pattern: /\bdestroyInactiveTabPane\b/, hint: 'Tabs: destroyInactiveTabPane → destroyOnHidden' },
  { pattern: /\bdestroyTooltipOnHide\b/, hint: 'Tooltip: destroyTooltipOnHide → destroyOnHidden' },
  { pattern: /\bvisible=\{/, hint: 'Modal/Drawer: visible → open' },
  { pattern: /\bTimeline\.Item\b/, hint: 'Timeline.Item → items' },
  { pattern: /\bTabs\.TabPane\b/, hint: 'Tabs.TabPane → items' },
  { pattern: /\bAlert[^>]*\bmessage=/, hint: 'Alert: message → title' },
  { pattern: /\bbodyStyle=\{/, hint: 'Modal: bodyStyle → styles.body' },
  { pattern: /\bmaskStyle=\{/, hint: 'Modal: maskStyle → styles.mask' },
  {
    pattern: /\boverlayClassName=/,
    hint: 'Select/Tooltip: overlayClassName → classNames.popup/root'
  },
  { pattern: /\bpopupClassName=/, hint: 'Select: popupClassName → classNames.popup.root' },
  { pattern: /\bdropdownClassName=/, hint: 'Select: dropdownClassName → classNames popup' },
  { pattern: /\btabPosition=/, hint: 'Tabs: tabPosition → tabPlacement' },
  { pattern: /\bTag[^>]*\bbordered=\{false\}/, hint: 'Tag: bordered={false} → variant="filled"' }
]

function collectTsxFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      if (entry === 'test') continue
      files.push(...collectTsxFiles(fullPath))
      continue
    }
    if (entry.endsWith('.tsx')) files.push(fullPath)
  }
  return files
}

function scanTimelineItems(content: string, rel: string): string[] {
  const hits: string[] = []
  const timelineBlocks = content.match(/<Timeline[\s\S]*?(?:\/>|<\/Timeline>)/g) ?? []

  for (const block of timelineBlocks) {
    if (/\bdot:/.test(block)) {
      hits.push(`${rel}: Timeline items.dot → items.icon`)
    }
    if (/\bchildren:/.test(block)) {
      hits.push(`${rel}: Timeline items.children → items.content`)
    }
  }

  return hits
}

function scanFile(filePath: string, patterns: Array<{ pattern: RegExp; hint: string }>): string[] {
  const content = readFileSync(filePath, 'utf8')
  const rel = relative(RENDERER_ROOT, filePath)
  const hits: string[] = []

  for (const { pattern, hint } of patterns) {
    if (!pattern.test(content)) continue
    hits.push(`${rel}: ${hint}`)
  }

  if (content.includes('<Timeline')) {
    hits.push(...scanTimelineItems(content, rel))
  }

  return hits
}

describe('antd deprecated API scan', () => {
  it('renderer 组件未使用已知弃用 props', () => {
    const files = collectTsxFiles(RENDERER_ROOT)
    const violations = files.flatMap((file) => scanFile(file, DEPRECATED_PATTERNS))

    expect(violations, violations.join('\n')).toEqual([])
  })
})
