import { createFileRoute } from '@tanstack/react-router'
import { ViewManager } from '@/components/layout/ViewManager'

export const Route = createFileRoute('/')({
  component: ViewManager,
})
