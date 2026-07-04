import type { SeasonAvailability } from '@lolarr/domain'

export function selectableSeasonNumbers(seasons: SeasonAvailability[]): number[] {
  return seasons
    .filter((season) => season.availability === 'requestable' || season.availability === 'unavailable')
    .map((season) => season.seasonNumber)
}

export function toggleSeason(selection: number[], seasonNumber: number): number[] {
  return selection.includes(seasonNumber)
    ? selection.filter((selected) => selected !== seasonNumber)
    : [...selection, seasonNumber].sort((a, b) => a - b)
}
