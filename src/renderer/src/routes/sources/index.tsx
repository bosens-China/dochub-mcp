import { createFileRoute } from '@tanstack/react-router'
import { SourcesPage } from '@renderer/pages/SourcesPage'

export const Route = createFileRoute('/sources/')({
  component: SourcesPage
})
