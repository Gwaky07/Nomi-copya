import { describe, it, expect } from 'vitest'
import { canRunGenerationNode, getGenerationNodeReadiness } from './generationRunController'
import type { GenerationCanvasNode } from '../model/generationCanvasTypes'

// 回归：Seedance omni 视频节点放了参考数组就该「可生成」。修复前 canRunGenerationNode 只看
// 首/尾帧 + referenceImages，看不到 referenceImageUrls → omni 节点 ↑ 按钮被锁死、误提示「需要首帧」。

function videoNode(modeId: string, meta: Record<string, unknown> = {}): GenerationCanvasNode {
  return {
    id: 'v1', kind: 'video', title: 'v', position: { x: 0, y: 0 }, prompt: '',
    meta: { modelKey: 'seedance-2', archetype: { id: 'seedance-2', modeId }, ...meta },
  } as GenerationCanvasNode
}

function modelVideoNode(
  modelKey: string,
  archetypeId: string,
  modeId: string,
  meta: Record<string, unknown> = {},
): GenerationCanvasNode {
  return {
    id: 'v1', kind: 'video', title: 'v', position: { x: 0, y: 0 }, prompt: '',
    meta: { modelKey, archetype: { id: archetypeId, modeId }, ...meta },
  } as GenerationCanvasNode
}

describe('canRunGenerationNode — 视频节点参考判定', () => {
  it('HappyHorse 文生视频无需参考 → 可生成', () => {
    expect(canRunGenerationNode(modelVideoNode('happyhorse', 'happyhorse', 't2v'), { nodes: [], edges: [] })).toBe(true)
  })

  it('HappyHorse 视频编辑缺源视频 → 不可生成；有源视频 → 可生成', () => {
    expect(canRunGenerationNode(modelVideoNode('happyhorse', 'happyhorse', 'edit'), { nodes: [], edges: [] })).toBe(false)
    expect(canRunGenerationNode(modelVideoNode('happyhorse', 'happyhorse', 'edit', { sourceVideoUrl: 'nomi-local://asset/p/edit.mp4' }), { nodes: [], edges: [] })).toBe(true)
  })

  it('Seedance apimart 文生视频无需参考 → 可生成', () => {
    expect(canRunGenerationNode(modelVideoNode('doubao-seedance-2.0', 'seedance-2-apimart', 't2v'), { nodes: [], edges: [] })).toBe(true)
  })

  it('即梦 Seedance 文生视频无需参考 → 可生成', () => {
    expect(canRunGenerationNode(modelVideoNode('dreamina-seedance-2.0', 'dreamina-seedance-2', 't2v'), { nodes: [], edges: [] })).toBe(true)
  })

  it('omni 无任何参考 → 不可生成', () => {
    expect(canRunGenerationNode(videoNode('omni'), { nodes: [], edges: [] })).toBe(false)
  })
  it('omni 放了角色图数组 → 可生成（修复点）', () => {
    const node = videoNode('omni', { referenceImageUrls: ['https://cdn/c1.png'] })
    expect(canRunGenerationNode(node, { nodes: [node], edges: [] })).toBe(true)
  })
  it('omni 放了参考视频（nomi-local，传输前本地化）→ 可生成', () => {
    const node = videoNode('omni', { referenceVideoUrls: ['nomi-local://asset/p/v.mp4'] })
    expect(canRunGenerationNode(node, { nodes: [node], edges: [] })).toBe(true)
  })
  it('首帧模式：有 firstFrameUrl → 可生成；空 → 不可', () => {
    expect(canRunGenerationNode(videoNode('first', { firstFrameUrl: 'https://cdn/f.png' }), { nodes: [], edges: [] })).toBe(true)
    expect(canRunGenerationNode(videoNode('first'), { nodes: [], edges: [] })).toBe(false)
  })
  it('image / text 节点始终可生成（prompt 缺失由下游兜底）', () => {
    expect(canRunGenerationNode({ kind: 'image' } as GenerationCanvasNode)).toBe(true)
    expect(canRunGenerationNode({ kind: 'text' } as GenerationCanvasNode)).toBe(true)
  })

  it('即梦超清缺输入图 → 本地拦截，不再打到 CLI 才 exit=1', () => {
    const node: GenerationCanvasNode = {
      id: 'i1',
      kind: 'image',
      title: 'upscale',
      position: { x: 0, y: 0 },
      prompt: '生成一只小猫',
      meta: {
        modelKey: 'dreamina-upscale',
        modelVendor: 'dreamina',
        vendor: 'dreamina',
        archetype: { id: 'dreamina-upscale', modeId: 'upscale' },
      },
    }
    const readiness = getGenerationNodeReadiness(node)
    expect(readiness.ok).toBe(false)
    expect(readiness.reason).toContain('输入图')
  })

  it('即梦超清有输入图 → 可生成', () => {
    const node: GenerationCanvasNode = {
      id: 'i1',
      kind: 'image',
      title: 'upscale',
      position: { x: 0, y: 0 },
      prompt: '',
      meta: {
        modelKey: 'dreamina-upscale',
        modelVendor: 'dreamina',
        vendor: 'dreamina',
        archetype: { id: 'dreamina-upscale', modeId: 'upscale' },
        referenceImageUrls: ['nomi-local://asset/p/input.png'],
      },
    }
    expect(canRunGenerationNode(node)).toBe(true)
  })
})
