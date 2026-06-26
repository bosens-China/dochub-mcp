import { useEffect, useState, type ReactNode } from 'react'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { AnyRouter } from '@tanstack/react-router'

interface DeveloperPanelsProps {
  router: AnyRouter
}

export function DeveloperPanels({ router }: DeveloperPanelsProps): ReactNode {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    return window.api.onDeveloperPanelToggle(() => {
      setOpen((value) => !value)
    })
  }, [])

  if (!import.meta.env.DEV || !open) return null

  return (
    <>
      <TanStackRouterDevtools router={router} position="bottom-right" />
      <ReactQueryDevtools initialIsOpen buttonPosition="bottom-left" />
    </>
  )
}
