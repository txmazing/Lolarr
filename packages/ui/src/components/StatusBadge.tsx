import type { Availability } from '@lolarr/domain'
import { labelForAvailability } from './availabilityLabels'

export function StatusBadge({ availability }: { availability: Availability }) {
  return (
    <span className={`status-badge status-${availability}`}>
      {labelForAvailability(availability)}
    </span>
  )
}
