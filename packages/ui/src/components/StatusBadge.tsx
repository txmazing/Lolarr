import type { Availability } from '@lolarr/domain'
import { cn } from '@ui/lib/utils'
import { labelForAvailability } from './availabilityLabels'

// Bare LED dot: status colour lives only on the dot, never as a fill/border
// on the chip itself. Reuses the shared --status-* tokens; no new colours.
const DOT_CLASSES: Record<Availability, string> = {
  available: 'bg-status-available',
  partiallyAvailable: 'bg-status-pending',
  processing: 'bg-status-processing',
  requested: 'bg-status-requested',
  requestable: 'bg-muted-foreground',
  unavailable: 'bg-muted-foreground',
}

export function StatusBadge({ availability }: { availability: Availability }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs text-foreground backdrop-blur-[8px]">
      <span className={cn('size-[7px] rounded-full', DOT_CLASSES[availability])} />
      {labelForAvailability(availability)}
    </span>
  )
}
