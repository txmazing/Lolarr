import type { RequestStatus } from '@lolarr/domain'
import { Badge } from '@ui/components/ui/shadcn/badge'
import { cn } from '@ui/lib/utils'
import { labelForRequestStatus } from './requestStatusLabels'

const REQUEST_STATUS_CLASSES: Record<RequestStatus, string> = {
  pending: 'text-status-pending border-status-pending/40 bg-status-pending/10',
  approved: 'text-status-processing border-status-processing/40 bg-status-processing/10',
  processing: 'text-status-processing border-status-processing/40 bg-status-processing/10',
  available: 'text-status-available border-status-available/40 bg-status-available/10',
  declined: 'text-status-declined border-status-declined/40 bg-status-declined/10',
  failed: 'text-status-failed border-status-failed/40 bg-status-failed/10',
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge variant="outline" className={cn('rounded-full font-medium', REQUEST_STATUS_CLASSES[status])}>
      {labelForRequestStatus(status)}
    </Badge>
  )
}
