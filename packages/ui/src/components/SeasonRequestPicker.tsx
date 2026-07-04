import { useMemo, useState } from 'react'
import type { SeasonAvailability } from '@lolarr/domain'
import type { ActionComponent } from './types'
import { labelForAvailability } from './availabilityLabels'
import { selectableSeasonNumbers, toggleSeason } from './seasonSelection'

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
  const allSelected = selectable.length > 0 && selection.length === selectable.length

  return (
    <div className="season-picker-backdrop">
      <section className="season-picker" aria-label="Request seasons">
        <h3>Request seasons</h3>
        <ul>
          <li>
            <Action
              className="ghost-action"
              onPress={() => setSelection(allSelected ? [] : selectable)}
              focusKey="season-pick-all"
              disabled={selectable.length === 0}
            >
              {allSelected ? 'Clear selection' : 'All seasons'}
            </Action>
          </li>
          {seasons.map((season) => {
            const isSelectable = selectable.includes(season.seasonNumber)
            const isSelected = selection.includes(season.seasonNumber)
            return (
              <li key={season.seasonNumber}>
                <Action
                  className={isSelected ? 'season-option selected' : 'season-option'}
                  onPress={() => setSelection((current) => toggleSeason(current, season.seasonNumber))}
                  focusKey={`season-pick-${season.seasonNumber}`}
                  disabled={!isSelectable}
                >
                  <span>{season.name ?? `Season ${season.seasonNumber}`}</span>
                  <small>{isSelectable ? (isSelected ? 'Selected' : '') : labelForAvailability(season.availability)}</small>
                </Action>
              </li>
            )
          })}
        </ul>
        {errorMessage ? <p className="request-error">{errorMessage}</p> : null}
        <div className="season-picker-actions">
          <Action
            className="primary-action"
            onPress={() => onConfirm(selection)}
            focusKey="season-pick-confirm"
            disabled={selection.length === 0 || isRequesting}
          >
            {isRequesting
              ? 'Requesting...'
              : `Request ${selection.length} ${selection.length === 1 ? 'season' : 'seasons'}`}
          </Action>
          <Action className="ghost-action" onPress={onClose} focusKey="season-pick-cancel" disabled={isRequesting}>
            Cancel
          </Action>
        </div>
      </section>
    </div>
  )
}
