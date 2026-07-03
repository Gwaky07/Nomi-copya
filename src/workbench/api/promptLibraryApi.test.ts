import { describe, expect, it } from 'vitest'
import { toPromptMediaUrl } from './promptLibraryApi'

describe('toPromptMediaUrl', () => {
  it('proxies http(s) prompt media through nomi-local', () => {
    const raw = 'https://video.twimg.com/x/y.mp4?a=1'
    expect(toPromptMediaUrl(raw)).toBe(`nomi-local://prompt-media/?url=${encodeURIComponent(raw)}`)
  })

  it('keeps local and empty media URLs unchanged', () => {
    expect(toPromptMediaUrl('nomi-local://asset/p/a.png')).toBe('nomi-local://asset/p/a.png')
    expect(toPromptMediaUrl('')).toBe('')
  })
})
