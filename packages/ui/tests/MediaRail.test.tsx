// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { MediaItem } from '@lolarr/domain'
import { MediaRail } from '@ui/components/MediaRail'
import { DefaultAction } from '@ui/components/DefaultAction'

afterEach(cleanup)

const items = [
  { id: '1', title: 'A', posterUrl: 'a.jpg', mediaType: 'movie', availability: 'available' },
] as unknown as MediaItem[]

describe('MediaRail', () => {
  it('markiert den horizontalen Scroller als lolarr-rail (scroll-padding-Anker)', () => {
    const { container } = render(
      <MediaRail id="row" title="Row" items={items} onOpen={() => {}} Action={DefaultAction} />,
    )
    const rail = container.querySelector('.lolarr-rail')
    expect(rail).toBeTruthy()
    expect(rail?.className).toContain('overflow-x-auto')
  })
})
