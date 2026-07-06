import type { RequestStatus } from '@lolarr/domain'
import { cn } from '@ui/lib/utils'
import { labelForRequestStatus } from './requestStatusLabels'

// Bare LED dot: status colour lives only on the dot, never as a fill/border
// on the chip itself. Mirrors StatusBadge — reuses the shared --status-*
// tokens; no new colours.
const DOT_CLASSES: Record<RequestStatus, string> = {
  pending: 'bg-status-pending',
  approved: 'bg-status-processing',
  processing: 'bg-status-processing',
  available: 'bg-status-available',
  declined: 'bg-status-declined',
  failed: 'bg-status-failed',
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs text-foreground backdrop-blur-[8px]">
      <span className={cn('size-[7px] rounded-full', DOT_CLASSES[status])} />
      {labelForRequestStatus(status)}
    </span>
  )
}
