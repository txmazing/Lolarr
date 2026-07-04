import { describe, expect, it } from 'vitest'
import { selectableSeasonNumbers, toggleSeason, pruneSelection } from '../src/components/seasonSelection.js'

describe('selectableSeasonNumbers', () => {
  it('keeps only requestable and unavailable seasons', () => {
    expect(
      selectableSeasonNumbers([
        { seasonNumber: 1, availability: 'available' },
        { seasonNumber: 2, availability: 'requested' },
        { seasonNumber: 3, availability: 'requestable' },
        { seasonNumber: 4, availability: 'unavailable' },
        { seasonNumber: 5, availability: 'processing' },
      ]),
    ).toEqual([3, 4])
  })
})

describe('toggleSeason', () => {
  it('adds a missing season keeping the list sorted', () => {
    expect(toggleSeason([3], 1)).toEqual([1, 3])
  })

  it('removes an already selected season', () => {
    expect(toggleSeason([1, 3], 3)).toEqual([1])
  })
})

describe('pruneSelection', () => {
  it('removes seasons no longer selectable', () => {
    expect(pruneSelection([1, 2, 3], [2, 3])).toEqual([2, 3])
  })

  it('keeps an empty selection empty', () => {
    expect(pruneSelection([], [1])).toEqual([])
  })

  it('returns empty array when no selected season is selectable', () => {
    expect(pruneSelection([1, 2], [3])).toEqual([])
  })
})
