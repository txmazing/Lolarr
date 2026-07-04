import type { RequestStatus } from '@lolarr/domain'
import { labelForRequestStatus } from './requestStatusLabels'

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`status-badge request-status-${status}`}>
      {labelForRequestStatus(status)}
    </span>
  )
}
