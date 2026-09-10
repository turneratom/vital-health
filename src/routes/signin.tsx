import { createFileRoute } from '@tanstack/react-router'
import SystemAccess from '@/components/SystemAccess'

export const Route = createFileRoute('/signin')({
  component: () => <SystemAccess mode="signin" />,
})
