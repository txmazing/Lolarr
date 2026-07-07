// Deterministic rail-grid navigation layered on top of Norigin Spatial
// Navigation. Kept Norigin-free (packages/ui constraint) via dependency
// injection: the shell passes Norigin's `setFocus` + `getCurrentFocusKey`.
//
// It gives the media rails two behaviours geometry alone can't:
//   • per-rail focus memory — Up/Down moves rail-to-rail and resumes each rail
//     at the card you last left it on (not the geometrically-nearest one);
//   • forward snake — Right on the last card of a rail jumps to the first card
//     of the next rail instead of dead-ending.
//
// DOM contract: each rail's scroll container carries `data-rail="<id>"`; each
// focusable card carries `data-focus-key="<key>"` (the same key Norigin uses).
//
// Lookups are cached so arrow-key handling never rescans the whole document
// per keypress (rails are not virtualised — hundreds of cards are mounted).
// A MutationObserver drops the cache on any DOM change; isConnected guards
// catch same-task removals the (async) observer has not delivered yet.

type RailNavDeps = {
  setFocus: (focusKey: string) => void
  getCurrentFocusKey: () => string
}

type RailNavCache = {
  cardByKey: Map<string, HTMLElement>
  rails: HTMLElement[]
  cardsByRail: Map<HTMLElement, HTMLElement[]>
}

function buildCache(): RailNavCache {
  const cardByKey = new Map<string, HTMLElement>()
  const cardsByRail = new Map<HTMLElement, HTMLElement[]>()
  const rails = Array.from(document.querySelectorAll<HTMLElement>('[data-rail]'))
  for (const rail of rails) {
    const cards = Array.from(rail.querySelectorAll<HTMLElement>('[data-focus-key]'))
    cardsByRail.set(rail, cards)
    for (const card of cards) {
      const key = card.getAttribute('data-focus-key')
      if (key) {
        cardByKey.set(key, card)
      }
    }
  }
  return { cardByKey, rails, cardsByRail }
}

function railOf(el: Element | null): HTMLElement | null {
  return (el?.closest<HTMLElement>('[data-rail]')) ?? null
}

function keyOf(el: Element | null): string | null {
  return el?.getAttribute('data-focus-key') ?? null
}

export function installRailNavigation(deps: RailNavDeps): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  // railId -> the card key last focused within that rail.
  const lastCardByRail = new Map<string, string>()

  let cache: RailNavCache | null = null
  const observer = new MutationObserver(() => {
    cache = null
  })
  observer.observe(document.body, { childList: true, subtree: true })

  function getCache(): RailNavCache {
    cache ??= buildCache()
    return cache
  }

  function cardByKey(key: string): HTMLElement | null {
    if (!key) {
      return null
    }
    const el = getCache().cardByKey.get(key) ?? null
    if (el && !el.isConnected) {
      cache = null
      return getCache().cardByKey.get(key) ?? null
    }
    return el
  }

  function cardsIn(rail: HTMLElement): HTMLElement[] {
    const cards = getCache().cardsByRail.get(rail) ?? []
    if (cards.some((card) => !card.isConnected)) {
      cache = null
      return getCache().cardsByRail.get(rail) ?? []
    }
    return cards
  }

  function railList(): HTMLElement[] {
    const rails = getCache().rails
    if (rails.some((rail) => !rail.isConnected)) {
      cache = null
      return getCache().rails
    }
    return rails
  }

  function currentCard(): HTMLElement | null {
    return cardByKey(deps.getCurrentFocusKey())
  }

  // The card to focus when entering `rail`: the remembered one if it still
  // lives in this rail, else the first card.
  function entryCard(rail: HTMLElement): HTMLElement | null {
    const railId = rail.getAttribute('data-rail') ?? ''
    const remembered = lastCardByRail.get(railId)
    if (remembered) {
      const el = cardByKey(remembered)
      if (el && railOf(el) === rail) {
        return el
      }
    }
    return cardsIn(rail)[0] ?? null
  }

  function moveTo(target: HTMLElement | null, event: KeyboardEvent): void {
    const key = keyOf(target)
    if (!key) {
      return
    }
    event.preventDefault()
    event.stopImmediatePropagation()
    deps.setFocus(key)
  }

  function handleKeydown(event: KeyboardEvent): void {
    const { key } = event
    if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'ArrowLeft' && key !== 'ArrowRight') {
      return
    }

    const card = currentCard()
    const rail = railOf(card)

    // Record where we are before moving, so a rail resumes where we left it.
    if (card && rail) {
      lastCardByRail.set(rail.getAttribute('data-rail') ?? '', keyOf(card) ?? '')
    }

    // Not on a rail card (nav, hero, dialog) — let Norigin handle it.
    if (!card || !rail) {
      return
    }

    const rails = railList()
    const idx = rails.indexOf(rail)

    if (key === 'ArrowDown') {
      const next = rails[idx + 1]
      if (next) {
        moveTo(entryCard(next), event)
      }
      return
    }

    if (key === 'ArrowUp') {
      const prev = rails[idx - 1]
      // No previous rail → let Norigin navigate up out of the rails (hero/nav).
      if (prev) {
        moveTo(entryCard(prev), event)
      }
      return
    }

    if (key === 'ArrowRight') {
      const cards = cardsIn(rail)
      // Only snake at the end of the rail; otherwise Norigin moves within it.
      if (cards[cards.length - 1] === card) {
        const next = rails[idx + 1]
        if (next) {
          moveTo(cardsIn(next)[0] ?? null, event)
        }
      }
      return
    }

    // ArrowLeft: forward-only snake — no wrap; Norigin handles within-rail.
  }

  window.addEventListener('keydown', handleKeydown, true)
  return () => {
    window.removeEventListener('keydown', handleKeydown, true)
    observer.disconnect()
  }
}
