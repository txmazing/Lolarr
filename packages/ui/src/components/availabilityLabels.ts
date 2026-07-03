import type { Availability } from '@lolarr/domain'

export function labelForAvailability(availability: Availability) {
  switch (availability) {
    case 'available':
      return 'Available'
    case 'partiallyAvailable':
      return 'Partially available'
    case 'processing':
      return 'Processing'
    case 'requested':
      return 'Requested'
    case 'requestable':
      return 'Requestable'
    case 'unavailable':
      return 'Unavailable'
  }
}
