import { beforeEach, describe, expect, it } from 'vitest'
import { useScreenStore } from '../src/navigation/store.js'

describe('useScreenStore', () => {
  beforeEach(() => {
    useScreenStore.setState({ stack: [{ name: 'home' }] })
  })

  describe('replace()', () => {
    it('swaps only the top of the stack', () => {
      const store = useScreenStore.getState()
      store.push({ name: 'libraryDetail', itemId: 'item-1' })
      store.push({ name: 'libraryDetail', itemId: 'item-2' })

      const beforeReplace = useScreenStore.getState()
      const initialLength = beforeReplace.stack.length
      const screenBelow = beforeReplace.stack[0]

      store.replace({ name: 'detail', item: { id: 'new-item', name: 'New Item', type: 'show', rating: 8 } })

      const updatedState = useScreenStore.getState()
      expect(updatedState.stack.length).toBe(initialLength)
      expect(updatedState.stack[0]).toBe(screenBelow)
      expect(updatedState.stack[initialLength - 1].name).toBe('detail')
    })

    it('leaves exactly one element when replacing on a single-element stack', () => {
      const store = useScreenStore.getState()
      expect(store.stack.length).toBe(1)
      expect(store.stack[0].name).toBe('home')

      store.replace({ name: 'libraryDetail', itemId: 'item-1' })

      const updatedState = useScreenStore.getState()
      expect(updatedState.stack.length).toBe(1)
      expect(updatedState.stack[0].name).toBe('libraryDetail')
      expect(updatedState.stack[0].itemId).toBe('item-1')
    })
  })

  describe('player screen', () => {
    it('round-trips itemId, resumeTicks, and seriesId via push', () => {
      const store = useScreenStore.getState()
      const playerScreen = {
        name: 'player' as const,
        itemId: 'episode-123',
        resumeTicks: 45000,
        seriesId: 'series-456',
      }

      store.push(playerScreen)

      const current = useScreenStore.getState().stack[useScreenStore.getState().stack.length - 1]
      expect(current.name).toBe('player')
      if (current.name === 'player') {
        expect(current.itemId).toBe('episode-123')
        expect(current.resumeTicks).toBe(45000)
        expect(current.seriesId).toBe('series-456')
      }
    })

    it('round-trips player screen with optional resumeTicks', () => {
      const store = useScreenStore.getState()
      const playerScreen = {
        name: 'player' as const,
        itemId: 'movie-789',
        seriesId: 'series-999',
      }

      store.push(playerScreen)

      const current = useScreenStore.getState().stack[useScreenStore.getState().stack.length - 1]
      expect(current.name).toBe('player')
      if (current.name === 'player') {
        expect(current.itemId).toBe('movie-789')
        expect(current.resumeTicks).toBeUndefined()
        expect(current.seriesId).toBe('series-999')
      }
    })
  })
})
