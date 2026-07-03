import { beforeEach, describe, expect, it, vi } from 'vitest'
import { filterImportableMediaFiles, importLocalMediaFilesToGenerationCanvas } from './assetImportAdapter'
import { useGenerationCanvasStore, __resetGenerationCanvasHistoryForTests } from '../store/generationCanvasStore'

function makeImageFile(name = 'image.png', size = 1024): File {
  return new File([new Uint8Array(size)], name, {
    type: 'image/png',
    lastModified: 1,
  })
}

function makeVideoFile(name = 'clip.mp4', size = 4096): File {
  return new File([new Uint8Array(size)], name, {
    type: 'video/mp4',
    lastModified: 1,
  })
}

function makeGenericFile(name: string, type = 'application/octet-stream', size = 1024, lastModified = 1): File {
  return new File([new Uint8Array(size)], name, {
    type,
    lastModified,
  })
}

describe('importLocalMediaFilesToGenerationCanvas', () => {
  beforeEach(() => {
    __resetGenerationCanvasHistoryForTests()
    useGenerationCanvasStore.getState().restoreSnapshot({
      nodes: [],
      edges: [],
      selectedNodeIds: [],
      groups: [],
    })
  })

  it('does not persist a data URL before the local asset import finishes', async () => {
    let resolveUpload: ((asset: any) => void) | null = null
    const uploadFile = vi.fn(() => new Promise<any>((resolve) => {
      resolveUpload = resolve
    }))
    const promise = importLocalMediaFilesToGenerationCanvas([makeImageFile()], {
      basePosition: { x: 10, y: 20 },
      createObjectUrl: () => 'blob:preview',
      revokeObjectUrl: vi.fn(),
      readImageDimensions: async () => ({ width: 100, height: 100 }),
      uploadFile,
      recoverFile: async () => null,
    })

    await vi.waitFor(() => {
      expect(useGenerationCanvasStore.getState().nodes).toHaveLength(1)
      expect(uploadFile).toHaveBeenCalledTimes(1)
    })

    const uploadingNode = useGenerationCanvasStore.getState().nodes[0]
    expect(uploadingNode.result?.url).toBeUndefined()
    expect(uploadingNode.history).toEqual([])
    expect(uploadingNode.meta?.uploadStatus).toBe('uploading')

    resolveUpload?.({
      id: 'asset-1',
      name: 'image',
      userId: 'local',
      createdAt: '',
      updatedAt: '',
      data: { url: 'nomi-local://asset/project-1/image.png' },
    })
    await promise

    const uploadedNode = useGenerationCanvasStore.getState().nodes[0]
    expect(uploadedNode.result?.url).toBe('nomi-local://asset/project-1/image.png')
    expect(uploadedNode.result?.url?.startsWith('data:')).toBe(false)
  })

  it('imports a video file as a video asset node and records real duration', async () => {
    const uploadFile = vi.fn(async () => ({
      id: 'asset-v',
      name: 'clip',
      userId: 'local',
      createdAt: '',
      updatedAt: '',
      data: { url: 'nomi-local://asset/project-1/clip.mp4' },
    }))
    await importLocalMediaFilesToGenerationCanvas([makeVideoFile()], {
      basePosition: { x: 10, y: 20 },
      createObjectUrl: () => 'blob:preview',
      revokeObjectUrl: vi.fn(),
      readImageDimensions: async () => null,
      readVideoDuration: async () => 12.5,
      uploadFile,
      recoverFile: async () => null,
    })

    const node = useGenerationCanvasStore.getState().nodes[0]
    expect(node.result?.type).toBe('video')
    expect(node.result?.url).toBe('nomi-local://asset/project-1/clip.mp4')
    expect(node.meta?.videoDuration).toBe(12.5)
  })

  it('keeps more than 8 media files when the caller opts out of the drag limit', async () => {
    const uploadFile = vi.fn(async (file: File) => ({
      id: `asset-${file.name}`,
      name: file.name,
      userId: 'local',
      createdAt: '',
      updatedAt: '',
      data: { url: `nomi-local://asset/project-1/${file.name}` },
    }))
    await importLocalMediaFilesToGenerationCanvas(
      Array.from({ length: 9 }, (_, index) => makeImageFile(`image-${index + 1}.png`, 1024 + index)),
      {
        basePosition: { x: 10, y: 20 },
        createObjectUrl: () => 'blob:preview',
        revokeObjectUrl: vi.fn(),
        readImageDimensions: async () => ({ width: 100, height: 100 }),
        uploadFile,
        recoverFile: async () => null,
        maxFiles: 999,
      },
    )

    const state = useGenerationCanvasStore.getState()
    expect(state.nodes).toHaveLength(9)
    expect(state.nodes.every((node, index) => node.title === `image-${index + 1}.png`)).toBe(true)
  })
})

describe('filterImportableMediaFiles', () => {
  it('falls back to file extension when MIME is generic or missing', () => {
    const result = filterImportableMediaFiles([
      makeGenericFile('poster.jpg'),
      makeGenericFile('teaser.mov'),
      makeGenericFile('audio.mp3'),
      makeGenericFile('ignore.pdf', 'application/pdf'),
    ])

    expect(result.files.map((file) => file.name)).toEqual(['poster.jpg', 'teaser.mov'])
    expect(result.skippedDuplicateCount).toBe(0)
    expect(result.skippedTooLargeCount).toBe(0)
  })
})
