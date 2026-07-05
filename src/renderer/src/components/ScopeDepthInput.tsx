import React, { useMemo } from 'react'
import { Radio } from 'antd'
import { calculateMaxDepth, getPrefixByDepth } from '@renderer/lib/format'

export interface ScopeDepthInputProps {
  seedUrl: string
  value?: string // pathPrefix
  onChange?: (pathPrefix: string) => void
}

export function ScopeDepthInput({
  seedUrl,
  value,
  onChange
}: ScopeDepthInputProps): React.JSX.Element | null {
  const maxDepth = calculateMaxDepth(seedUrl)

  const scopeOptions = useMemo(() => {
    return Array.from({ length: maxDepth + 1 }, (_, depth) => {
      const prefix = getPrefixByDepth(seedUrl, depth)
      const label = depth === 0 ? '当前目录' : depth === maxDepth ? '整个站点' : `上级 ${depth} 层`
      return { depth, prefix, label }
    })
  }, [maxDepth, seedUrl])

  // Derive current depth from value (pathPrefix)
  const currentDepth = useMemo(() => {
    if (!value) return 0
    try {
      const url = new URL(seedUrl)
      const urlParts = url.pathname.split('/').filter(Boolean)
      const prefixParts = value.split('/').filter(Boolean)
      return Math.max(0, urlParts.length - prefixParts.length)
    } catch {
      return 0
    }
  }, [seedUrl, value])

  const handleDepthChange = (depth: number): void => {
    const newPrefix = getPrefixByDepth(seedUrl, depth)
    onChange?.(newPrefix)
  }

  // Preview elements
  const { origin, activePath, inactivePath } = useMemo(() => {
    try {
      const url = new URL(seedUrl)
      const prefix = value || getPrefixByDepth(seedUrl, 0)

      const pathname = url.pathname
      if (pathname.startsWith(prefix)) {
        return {
          origin: url.origin,
          activePath: prefix,
          inactivePath: pathname.slice(prefix.length)
        }
      }
      return { origin: url.origin, activePath: pathname, inactivePath: '' }
    } catch {
      return { origin: '', activePath: seedUrl, inactivePath: '' }
    }
  }, [seedUrl, value])

  // If maxDepth is 0 (e.g. root domain), no slider is needed.
  if (maxDepth === 0 || !seedUrl) {
    return null
  }

  return (
    <div className="bg-archive-paper border border-archive-line rounded-lg p-4 mb-4">
      <div className="mb-3">
        <span className="text-sm font-semibold text-archive-ink">抓取范围</span>
        <p className="text-xs text-archive-muted mt-1 mb-0">
          选择爬虫可以进入的目录边界。范围越大，发现的页面越多，同步时间也越长。
        </p>
      </div>
      <Radio.Group
        className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full"
        value={currentDepth}
        onChange={(event) => handleDepthChange(Number(event.target.value))}
      >
        {scopeOptions.map((option) => (
          <Radio.Button
            key={option.depth}
            value={option.depth}
            className="h-auto! rounded! border-archive-line! px-3! py-2! text-left!"
          >
            <span className="block text-sm font-medium">{option.label}</span>
            <span className="block text-xs text-archive-muted font-mono truncate">
              {option.prefix}
            </span>
          </Radio.Button>
        ))}
      </Radio.Group>
      <div className="mt-2 text-xs font-mono bg-white p-2 border border-archive-line rounded overflow-hidden text-ellipsis whitespace-nowrap">
        <span className="text-archive-muted">{origin}</span>
        <span className="text-archive-teal font-bold bg-teal-50 px-0.5 rounded">{activePath}</span>
        <span className="text-gray-300 line-through">{inactivePath}</span>
      </div>
      <p className="text-xs text-archive-muted mt-2 mb-0 leading-relaxed">
        将抓取高亮路径下的链接；灰色划线部分不会作为边界外扩。
      </p>
    </div>
  )
}
