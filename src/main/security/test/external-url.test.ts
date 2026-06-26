import { describe, expect, it } from 'vitest'
import { isAllowedInAppNavigation, isSafeExternalUrl, parseExternalUrl } from '../external-url'

describe('parseExternalUrl', () => {
  it('parses https URLs', () => {
    expect(parseExternalUrl('https://electron-vite.org/guide/')?.hostname).toBe('electron-vite.org')
  })

  it('rejects invalid URLs', () => {
    expect(parseExternalUrl('not-a-url')).toBeNull()
  })
})

describe('isSafeExternalUrl', () => {
  it('allows https', () => {
    const url = parseExternalUrl('https://example.com')!
    expect(isSafeExternalUrl(url)).toBe(true)
  })

  it('blocks javascript protocol', () => {
    const url = parseExternalUrl('javascript:alert(1)')!
    expect(isSafeExternalUrl(url)).toBe(false)
  })

  it('allows http localhost only', () => {
    expect(isSafeExternalUrl(parseExternalUrl('http://localhost:5173')!)).toBe(true)
    expect(isSafeExternalUrl(parseExternalUrl('http://evil.com')!)).toBe(false)
  })
})

describe('isAllowedInAppNavigation', () => {
  it('allows file protocol in production', () => {
    expect(isAllowedInAppNavigation('file:///app/index.html', null)).toBe(true)
  })

  it('allows vite dev origin', () => {
    expect(isAllowedInAppNavigation('http://localhost:5173/', 'http://localhost:5173')).toBe(true)
    expect(isAllowedInAppNavigation('http://evil.com/', 'http://localhost:5173')).toBe(false)
  })
})
