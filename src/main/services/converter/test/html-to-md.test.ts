import { describe, expect, it } from 'vitest'
import { htmlToMd } from '../html-to-md'

describe('htmlToMd', () => {
  it('prefers visible main content over hidden agent documentation index', () => {
    const md = htmlToMd({
      url: 'https://docs.langchain.com/oss/python/langchain/overview',
      title: 'LangChain overview',
      html: `
        <html>
          <body>
            <blockquote class="sr-only" data-agent-docs-index="true" aria-hidden="true">
              <h2>Documentation Index</h2>
              <p>Fetch the complete documentation index at: <a href="/llms.txt">/llms.txt</a></p>
            </blockquote>
            <main>
              <h1>LangChain overview</h1>
              <p>LangChain provides create_agent: a minimal, highly configurable agent harness.</p>
              <section>
                <h2>Core benefits</h2>
                <p>Compose exactly the agent your use case needs.</p>
              </section>
            </main>
          </body>
        </html>
      `
    })

    expect(md).toContain('LangChain overview')
    expect(md).toContain('Core benefits')
    expect(md).not.toContain('Documentation Index')
    expect(md).not.toContain('/llms.txt')
  })

  it('uses readability fallback to drop layout noise without semantic main tags', () => {
    const md = htmlToMd({
      url: 'https://example.com/docs/page',
      title: 'Readable article',
      html: `
        <html>
          <body>
            <aside>
              <h2>Navigation</h2>
              <p>Overview Install API Changelog Examples Reference Sidebar</p>
            </aside>
            <div class="content">
              <h1>Readable Article</h1>
              <p>DocHub mirrors documentation locally so AI editors can search and read precise source material without repeatedly crawling remote websites.</p>
              <p>This paragraph gives the extractor enough real article text to select the content region and ignore surrounding layout furniture.</p>
              <p>The resulting Markdown should preserve the useful prose while dropping sidebar navigation noise.</p>
            </div>
          </body>
        </html>
      `
    })

    expect(md).toContain('Readable Article')
    expect(md).toContain('DocHub mirrors documentation locally')
    expect(md).not.toContain('Overview Install API Changelog')
  })
})
