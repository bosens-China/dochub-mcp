import { createFileRoute } from '@tanstack/react-router'
import { SyncPage } from '@renderer/pages/SyncPage'

export const Route = createFileRoute('/sync/')({
  component: SyncPage
})
