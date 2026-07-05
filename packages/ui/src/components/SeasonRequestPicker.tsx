import { useMemo, useState } from 'react'
import type { SeasonAvailability } from '@lolarr/domain'
import type { ActionComponent } from './types'
import { GlassDialog } from './ui/GlassDialog'
import { cn } from '@ui/lib/utils'
import { labelForAvailability } from './availabilityLabels'
import { pruneSelection, selectableSeasonNumbers, toggleSeason } from './seasonSelection'

type SeasonRequestPickerProps = {
  seasons: SeasonAvailability[]
  isRequesting: boolean
  errorMessage?: string
  onConfirm: (seasons: number[]) => void
  onClose: () => void
  Action: ActionComponent
}

export function SeasonRequestPicker({
  seasons,
  isRequesting,
  errorMessage,
  onConfirm,
  onClose,
  Action,
}: SeasonRequestPickerProps) {
  const selectable = useMemo(() => selectableSeasonNumbers(seasons), [seasons])
  const [selection, setSelection] = useState<number[]>([])
  const validSelection = useMemo(() => pruneSelection(selection, selectable), [selection, selectable])
  const allSelected = selectable.length > 0 && validSelection.length === selectable.length

  return (
    <GlassDialog open onClose={onClose} title="Request seasons" ariaLabel="Request seasons">
      <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
        <Action
          variant="ghost"
          onPress={() => setSelection(allSelected ? [] : selectable)}
          focusKey="season-pick-all"
          disabled={selectable.length === 0}
          autoFocus
        >
          {allSelected ? 'Clear selection' : 'All seasons'}
        </Action>
        {seasons.map((season) => {
          const isSelectable = selectable.includes(season.seasonNumber)
          const isSelected = validSelection.includes(season.seasonNumber)
          return (
            <Action
              key={season.seasonNumber}
              className={cn('justify-between rounded-md', isSelected && 'bg-surface-3')}
              onPress={() => setSelection((current) => toggleSeason(current, season.seasonNumber))}
              focusKey={`season-pick-${season.seasonNumber}`}
              disabled={!isSelectable}
            >
              <span>{season.name ?? `Season ${season.seasonNumber}`}</span>
              <small>{isSelectable ? (isSelected ? 'Selected' : '') : labelForAvailability(season.availability)}</small>
            </Action>
          )
        })}
      </div>
      {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
      <div className="flex gap-3 justify-end pt-2">
        <Action
          variant="primary"
          onPress={() => onConfirm(validSelection)}
          focusKey="season-pick-confirm"
          disabled={validSelection.length === 0 || isRequesting}
        >
          {isRequesting
            ? 'Requesting...'
            : `Request ${validSelection.length} ${validSelection.length === 1 ? 'season' : 'seasons'}`}
        </Action>
        <Action variant="ghost" onPress={onClose} focusKey="season-pick-cancel" disabled={isRequesting}>
          Cancel
        </Action>
      </div>
    </GlassDialog>
  )
}
