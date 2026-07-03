import type { ActionComponent } from './types'

type SeasonSelectorProps = {
  Action: ActionComponent
  seasons: Array<{ id: string; name: string }>
  selectedId: string
  onSelect: (id: string) => void
}

export function SeasonSelector({ Action, seasons, selectedId, onSelect }: SeasonSelectorProps) {
  return (
    <nav className="season-selector" aria-label="Seasons">
      {seasons.map((season) => (
        <Action
          key={season.id}
          focusKey={`season-${season.id}`}
          className={season.id === selectedId ? 'season-button selected' : 'season-button'}
          onPress={() => onSelect(season.id)}
        >
          {season.name}
        </Action>
      ))}
    </nav>
  )
}
