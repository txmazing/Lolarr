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
    <label className="my-7 grid gap-2 text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
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
