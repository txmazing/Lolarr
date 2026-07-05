import { PillTabs } from './ui/PillTabs'
import type { ActionComponent } from './types'

type SeasonSelectorProps = {
  Action: ActionComponent
  seasons: Array<{ id: string; name: string }>
  selectedId: string
  onSelect: (id: string) => void
}

export function SeasonSelector({ Action, seasons, selectedId, onSelect }: SeasonSelectorProps) {
  return (
    <PillTabs
      ariaLabel="Seasons"
      Action={Action}
      items={seasons.map((s) => ({ id: s.id, label: s.name }))}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  )
}
