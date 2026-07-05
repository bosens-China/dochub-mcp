import { describe, expect, it } from 'vitest'
import { extractNavigationFromHtml } from '../navigation'

const sidebarHtml = `<!doctype html>
<html>
  <body>
    <nav>
      <a href="/github">GitHub</a>
    </nav>
    <nav class="hidden sticky">
      <ul class="sidebar-group">
        <li data-title="Overview"><a href="/oss/python/langchain/overview">Overview</a></li>
      </ul>
      <div class="my-2">
        <div class="sidebar-group-header"><span class="sidebar-title">Get started</span></div>
        <ul class="sidebar-group">
          <li data-title="Install"><a href="/oss/python/langchain/install">Install</a></li>
          <li data-title="Quickstart"><a href="/oss/python/langchain/quickstart">Quickstart</a></li>
          <li data-title="Changelog">
            <a href="https://docs.langchain.com/oss/python/releases/changelog">Changelog</a>
          </li>
        </ul>
      </div>
      <div class="my-2">
        <div class="sidebar-group-header">Core components</div>
        <ul class="sidebar-group">
          <li data-title="Agents"><a href="/oss/python/langchain/agents">Agents</a></li>
          <li data-title="Models"><a href="/oss/python/langchain/models">Models</a></li>
        </ul>
      </div>
    </nav>
  </body>
</html>`

describe('extractNavigationFromHtml', () => {
  it('extracts Mintlify sidebar order, labels and groups within scope', () => {
    const items = extractNavigationFromHtml(
      sidebarHtml,
      'https://docs.langchain.com/oss/python/langchain/overview',
      '/oss/python/langchain/'
    )

    expect(items).toEqual([
      {
        url: 'https://docs.langchain.com/oss/python/langchain/overview',
        title: 'Overview',
        groups: [],
        order: 0
      },
      {
        url: 'https://docs.langchain.com/oss/python/langchain/install',
        title: 'Install',
        groups: ['Get started'],
        order: 1
      },
      {
        url: 'https://docs.langchain.com/oss/python/langchain/quickstart',
        title: 'Quickstart',
        groups: ['Get started'],
        order: 2
      },
      {
        url: 'https://docs.langchain.com/oss/python/langchain/agents',
        title: 'Agents',
        groups: ['Core components'],
        order: 3
      },
      {
        url: 'https://docs.langchain.com/oss/python/langchain/models',
        title: 'Models',
        groups: ['Core components'],
        order: 4
      }
    ])
  })
})
