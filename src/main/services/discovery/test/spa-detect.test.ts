import { describe, expect, it } from 'vitest'
import { SPA_MARKDOWN_PREVIEW_THRESHOLD } from '@shared/constants/spa-detection'
import { scoreSpaDetection } from '../spa-detect'

const spaShellHtml = `<!DOCTYPE html>
<html><head><title>App</title></head>
<body><div id="root"></div>
<script src="/a.js"></script><script src="/b.js"></script>
<script src="/c.js"></script><script src="/d.js"></script><script src="/e.js"></script>
</body></html>`

const ssrDocHtml = `<!DOCTYPE html>
<html><head><title>Guide</title></head>
<body><main><article>
<h1>Getting Started</h1>
<p>${'Lorem ipsum dolor sit amet. '.repeat(80)}</p>
<h2>Install</h2><p>${'Step by step guide. '.repeat(40)}</p>
<h2>Usage</h2><p>${'More content here. '.repeat(40)}</p>
</article></main></body></html>`

describe('scoreSpaDetection', () => {
  it('flags likely SPA when markdown preview is under threshold', () => {
    const { score, signals } = scoreSpaDetection(spaShellHtml, 12)
    const mdSignal = signals.find((s) => s.id === 'low_markdown_preview')
    expect(mdSignal?.hit).toBe(true)
    expect(score).toBeGreaterThanOrEqual(61)
  })

  it('does not hit markdown signal when preview is substantial', () => {
    const longPreview = 'x'.repeat(SPA_MARKDOWN_PREVIEW_THRESHOLD + 50)
    const { signals } = scoreSpaDetection(ssrDocHtml, longPreview.length)
    const mdSignal = signals.find((s) => s.id === 'low_markdown_preview')
    expect(mdSignal?.hit).toBe(false)
  })
})
