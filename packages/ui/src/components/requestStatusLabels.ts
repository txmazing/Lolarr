import type { RequestStatus } from '@lolarr/domain'

export function labelForRequestStatus(status: RequestStatus) {
  switch (status) {
    case 'pending':
      return 'Pending approval'
    case 'approved':
      return 'Approved'
    case 'declined':
      return 'Declined'
    case 'processing':
      return 'Processing'
    case 'available':
      return 'Available'
    case 'failed':
      return 'Failed'
  }
}
