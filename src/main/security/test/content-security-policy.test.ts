import { describe, expect, it } from 'vitest'
import { buildContentSecurityPolicy } from '../content-security-policy'

describe('buildContentSecurityPolicy', () => {
  it('allows vite HMR inline scripts in dev', () => {
    const policy = buildContentSecurityPolicy(true)
    expect(policy).toContain("'unsafe-inline'")
    expect(policy).toContain("'unsafe-eval'")
    expect(policy).toContain('ws://localhost:*')
  })

  it('keeps production script-src strict', () => {
    const policy = buildContentSecurityPolicy(false)
    expect(policy).toContain("script-src 'self'")
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/)
    expect(policy).not.toMatch(/script-src[^;]*unsafe-eval/)
  })
})
