import { createRootRoute } from '@tanstack/react-router'
import { AppShell } from '@renderer/components/layout/AppShell'
import { RouteErrorFallback } from '@renderer/components/RouteErrorFallback'

export const Route = createRootRoute({
  component: AppShell,
  errorComponent: RouteErrorFallback
})
