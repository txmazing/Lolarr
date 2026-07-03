import type { TextInputComponent } from './types'

export function SearchBar({
  TextInput,
  query,
  onQueryChange,
}: {
  TextInput: TextInputComponent
  query: string
  onQueryChange: (query: string) => void
}) {
  return (
    <label className="search-bar">
      <span>Search</span>
      <TextInput
        autoComplete="off"
        enterKeyHint="search"
        focusKey="search-input"
        onValueChange={onQueryChange}
        placeholder="Movies, series, requests"
        value={query}
      />
    </label>
  )
}
