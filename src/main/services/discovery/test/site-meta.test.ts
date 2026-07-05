import { describe, expect, it } from 'vitest'
import { extractSiteMeta } from '../site-meta'

describe('extractSiteMeta', () => {
  it('extracts title, lang and meta charset', () => {
    const html = `<!doctype html><html lang="zh-CN"><head>
      <meta charset="UTF-8">
      <title>  DocHub 文档  </title>
    </head><body></body></html>`
    expect(extractSiteMeta(html)).toEqual({
      title: 'DocHub 文档',
      charset: 'utf-8',
      lang: 'zh-CN'
    })
  })

  it('falls back to http-equiv Content-Type for charset', () => {
    const html = `<html><head>
      <meta http-equiv="Content-Type" content="text/html; charset=GBK">
      <title>T</title></head><body></body></html>`
    expect(extractSiteMeta(html).charset).toBe('gbk')
  })

  it('falls back to the response Content-Type header for charset', () => {
    const html = '<html><head><title>T</title></head><body></body></html>'
    expect(extractSiteMeta(html, 'text/html; charset=ISO-8859-1').charset).toBe('iso-8859-1')
  })

  it('returns undefined fields when nothing is present', () => {
    expect(extractSiteMeta('<html><head></head><body></body></html>')).toEqual({
      title: undefined,
      charset: undefined,
      lang: undefined
    })
  })
})
