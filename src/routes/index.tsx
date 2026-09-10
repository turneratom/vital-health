import { createFileRoute } from '@tanstack/react-router'
import ProtocolOperatingSystem from '../components/ProtocolOperatingSystem'

export const Route = createFileRoute('/')({
  component: ProtocolOperatingSystem,
})
