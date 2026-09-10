import { createFileRoute } from '@tanstack/react-router'
import SystemAccess from '@/components/SystemAccess'

export const Route = createFileRoute('/signup')({
  component: () => <SystemAccess mode="signup" />,
})
