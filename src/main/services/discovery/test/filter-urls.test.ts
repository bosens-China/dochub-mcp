import { describe, expect, it } from 'vitest'
import { filterUrls } from '../index'

describe('filterUrls', () => {
  it('keeps seed in path scope', () => {
    const urls = filterUrls(
      ['https://electron-vite.org/guide/'],
      '/guide/'
    )
    expect(urls).toEqual(['https://electron-vite.org/guide/'])
  })
})
