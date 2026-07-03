import React from 'react'
import type { ModelOption } from '../../../config/models'
import type { GenerationCanvasNode } from '../model/generationCanvasTypes'
import { useGenerationCanvasStore } from '../store/generationCanvasStore'
import { buildModelControls, defaultPatchForControls, readMeta } from './controls/parameterControlModel'
import { ensureArchetypeNodeMeta, normalizeArchetypeVariantMeta, resolveArchetypeForModel } from './controls/archetypeMeta'
import { mergeMetaIfChanged } from './controls/metaPatch'
import { remapArchetypeMode } from '../runner/usableVendorModel'
import { showInfoToast } from '../../../utils/showInfoToast'
import { chooseDefaultModelOption, resolveArchetypeForOption } from './nodeModelArchetype'

type UseNodeModelAutoSelectArgs = {
  node: GenerationCanvasNode
  meta: Record<string, unknown>
  modelOptions: readonly ModelOption[]
  selectedModelValue: string
  selectedModelOption: ModelOption | null
  archetype: ReturnType<typeof resolveArchetypeForOption>
  isGenerationNode: boolean
  isImageLike: boolean
  isVideoLike: boolean
  updateNode: (nodeId: string, patch: Partial<GenerationCanvasNode>) => void
}

function readLatestMeta(nodeId: string, fallbackMeta: Record<string, unknown>): Record<string, unknown> {
  return useGenerationCanvasStore.getState().nodes.find((candidate) => candidate.id === nodeId)?.meta || fallbackMeta || {}
}

export function useNodeModelAutoSelect({
  node,
  meta,
  modelOptions,
  selectedModelValue,
  selectedModelOption,
  archetype,
  isGenerationNode,
  isImageLike,
  isVideoLike,
  updateNode,
}: UseNodeModelAutoSelectArgs): void {
  React.useEffect(() => {
    if (!isGenerationNode || selectedModelValue) return
    const latestMeta = readLatestMeta(node.id, meta)
    const firstOption = chooseDefaultModelOption(modelOptions, isImageLike, isVideoLike)
    if (!firstOption?.value) return
    const defaultPatch = defaultPatchForControls(buildModelControls(firstOption.meta, isImageLike, isVideoLike))
    const nextMeta = mergeMetaIfChanged(latestMeta, {
      modelKey: firstOption.modelKey || firstOption.value,
      modelAlias: firstOption.modelAlias || firstOption.value,
      modelVendor: firstOption.vendor || null,
      vendor: firstOption.vendor || null,
      modelLabel: firstOption.label,
      ...defaultPatch,
      ...(isVideoLike
        ? { videoModel: firstOption.value, videoModelVendor: firstOption.vendor || null }
        : { imageModel: firstOption.value, imageModelVendor: firstOption.vendor || null }),
    })
    if (!nextMeta) return
    updateNode(node.id, { meta: nextMeta })
  }, [isGenerationNode, isImageLike, isVideoLike, meta, modelOptions, node.id, selectedModelValue, updateNode])

  React.useEffect(() => {
    if (!isGenerationNode || !selectedModelOption) return
    const latestMeta = readLatestMeta(node.id, meta)
    const optionVendor = typeof selectedModelOption.vendor === 'string' ? selectedModelOption.vendor.trim() : ''
    const currentVendor =
      readMeta(latestMeta, 'modelVendor') ||
      readMeta(latestMeta, 'vendor') ||
      readMeta(latestMeta, isVideoLike ? 'videoModelVendor' : 'imageModelVendor')
    if (!optionVendor || currentVendor === optionVendor) return
    const nextMeta = mergeMetaIfChanged(latestMeta, {
      modelKey: selectedModelOption.modelKey || selectedModelOption.value,
      modelAlias: selectedModelOption.modelAlias || selectedModelOption.value,
      modelVendor: optionVendor,
      vendor: optionVendor,
      modelLabel: selectedModelOption.label,
      ...(isVideoLike
        ? { videoModel: selectedModelOption.value, videoModelVendor: optionVendor }
        : { imageModel: selectedModelOption.value, imageModelVendor: optionVendor }),
    })
    if (!nextMeta) return
    updateNode(node.id, { meta: nextMeta })
  }, [isGenerationNode, isImageLike, isVideoLike, meta, node.id, selectedModelOption, updateNode])

  // 变体合并 / 迁移：
  // 1) 把旧的具体变体 modelKey 折回基础 modelKey + archetype.variantId
  // 2) 只在语义状态真的变化时写回，避免同轮里两个 composer 实例互相推回去
  React.useEffect(() => {
    if (!isGenerationNode || !selectedModelValue) return
    const latestMeta = readLatestMeta(node.id, meta)
    const sourceArchetype = resolveArchetypeForModel({
      modelKey: selectedModelValue,
      modelAlias: readMeta(latestMeta, 'modelAlias'),
      vendorKey: readMeta(latestMeta, 'modelVendor') || readMeta(latestMeta, 'vendor'),
      meta: latestMeta,
    })
    if (!sourceArchetype?.variants?.length) return
    const patch = normalizeArchetypeVariantMeta(latestMeta, sourceArchetype)
    if (!patch) return
    const nextMeta = mergeMetaIfChanged(latestMeta, {
      ...patch,
      modelAlias: patch.modelKey,
      ...(isVideoLike ? { videoModel: patch.modelKey } : { imageModel: patch.modelKey }),
    })
    if (!nextMeta) return
    updateNode(node.id, { meta: nextMeta })
  }, [isGenerationNode, isImageLike, isVideoLike, meta, node.id, selectedModelValue, updateNode])

  // 供应商断开后，从下拉里自动切到当前可用选项。
  React.useEffect(() => {
    if (!isGenerationNode || !selectedModelValue || selectedModelOption) return
    const latestMeta = readLatestMeta(node.id, meta)
    const sourceArchetype = resolveArchetypeForModel({
      modelKey: selectedModelValue,
      modelAlias: readMeta(latestMeta, 'modelAlias'),
      vendorKey: readMeta(latestMeta, 'modelVendor') || readMeta(latestMeta, 'vendor'),
      meta: latestMeta,
    })
    if (!sourceArchetype) return
    const target =
      modelOptions.find((option) => resolveArchetypeForOption(option)?.id === sourceArchetype.id) ||
      modelOptions.find((option) => resolveArchetypeForOption(option)?.family === sourceArchetype.family)
    const optionVendor = typeof target?.vendor === 'string' ? target.vendor.trim() : ''
    if (!target?.value || !optionVendor) return
    const targetArchetype = resolveArchetypeForOption(target)
    const remapped = targetArchetype
      ? remapArchetypeMode(sourceArchetype, (latestMeta.archetype as { modeId?: string } | undefined)?.modeId, targetArchetype)
      : null
    const nextMeta = mergeMetaIfChanged(latestMeta, {
      modelKey: target.modelKey || target.value,
      modelAlias: target.modelAlias || target.value,
      modelVendor: optionVendor,
      vendor: optionVendor,
      modelLabel: target.label,
      ...(remapped ? { archetype: remapped } : {}),
      ...(isVideoLike
        ? { videoModel: target.value, videoModelVendor: optionVendor }
        : { imageModel: target.value, imageModelVendor: optionVendor }),
    })
    if (!nextMeta) return
    updateNode(node.id, { meta: nextMeta })
    showInfoToast(`原供应商已断开，已自动切换到 ${target.label}`, {
      id: `node-model-auto-switch:${target.value}`,
    })
  }, [isGenerationNode, isImageLike, isVideoLike, meta, modelOptions, node.id, selectedModelOption, selectedModelValue, updateNode])

  // 初次落地 archetype 命名空间。
  React.useEffect(() => {
    if (!isGenerationNode || !archetype) return
    const latestMeta = readLatestMeta(node.id, meta)
    const patch = ensureArchetypeNodeMeta(latestMeta, archetype)
    if (!patch) return
    const nextMeta = mergeMetaIfChanged(latestMeta, patch)
    if (!nextMeta) return
    updateNode(node.id, { meta: nextMeta })
  }, [isGenerationNode, archetype, meta, node.id, updateNode])
}
