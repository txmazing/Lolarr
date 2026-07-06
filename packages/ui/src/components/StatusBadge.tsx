import type { Availability } from '@lolarr/domain'
import { Badge } from '@ui/components/ui/Badge'
import { cn } from '@ui/lib/utils'
import { labelForAvailability } from './availabilityLabels'

const AVAILABILITY_CLASSES: Record<Availability, string> = {
  available: 'text-status-available border-status-available/40 bg-status-available/10',
  partiallyAvailable: 'text-status-available border-status-available/40 bg-status-available/10',
  processing: 'text-status-processing border-status-processing/40 bg-status-processing/10',
  requested: 'text-status-requested border-status-requested/40 bg-status-requested/10',
  requestable: 'text-muted-foreground border-border bg-surface',
  unavailable: 'text-muted-foreground border-border bg-surface',
}

export function StatusBadge({ availability }: { availability: Availability }) {
  return (
    <Badge variant="outline" className={cn('rounded-full font-medium', AVAILABILITY_CLASSES[availability])}>
      {labelForAvailability(availability)}
    </Badge>
  )
}
