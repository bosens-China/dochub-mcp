/** Session / document CSP aligned with renderer (no duplicate meta tag in index.html) */
export function buildContentSecurityPolicy(dev: boolean): string {
  const scriptSrc = dev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self'"

  const directives = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:"
  ]

  if (dev) {
    directives.push(
      "connect-src 'self' ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:*"
    )
  } else {
    directives.push("connect-src 'self'")
  }

  return directives.join('; ')
}
