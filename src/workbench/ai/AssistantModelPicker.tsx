import React from 'react'
import { listWorkbenchModelCatalogModels, type ModelCatalogModelDto } from '../api/modelCatalogApi'
import { getAssistantModelPref, setAssistantModelPref } from './assistantModelPref'
import { NomiSelect, NomiSkeleton } from '../../design'

const DEPRIORITIZE = /vision|preview|audio|tts|whisper|embed|rerank|ocr|search|thinking/i

function modelOptionValue(model: Pick<ModelCatalogModelDto, 'vendorKey' | 'modelKey'>): string {
  return `${model.vendorKey}::${model.modelKey}`
}

function pickDefaultModel(models: ModelCatalogModelDto[]): ModelCatalogModelDto | undefined {
  return [...models].sort(
    (a, b) =>
      (DEPRIORITIZE.test(`${a.modelKey} ${a.labelZh}`) ? 1 : 0) -
      (DEPRIORITIZE.test(`${b.modelKey} ${b.labelZh}`) ? 1 : 0),
  )[0]
}

export default function AssistantModelPicker({ className }: { className?: string } = {}): JSX.Element | null {
  const [models, setModels] = React.useState<ModelCatalogModelDto[]>([])
  const [loaded, setLoaded] = React.useState(false)
  const [modelKey, setModelKey] = React.useState<string>(() => {
    const pref = getAssistantModelPref()
    return pref ? modelOptionValue(pref) : ''
  })

  React.useEffect(() => {
    let alive = true
    listWorkbenchModelCatalogModels({ kind: 'text', enabled: true })
      .then((rows) => {
        if (!alive) return
        setModels(rows)
        setLoaded(true)
        if (!getAssistantModelPref()?.modelKey && rows.length > 0) {
          const def = pickDefaultModel(rows)
          if (def) {
            setAssistantModelPref({ vendorKey: def.vendorKey, modelKey: def.modelKey })
            setModelKey(modelOptionValue(def))
          }
        }
      })
      .catch(() => {
        if (alive) {
          setModels([])
          setLoaded(true)
        }
      })
    const sync = () => {
      const pref = getAssistantModelPref()
      setModelKey(pref ? modelOptionValue(pref) : '')
    }
    window.addEventListener('nomi:assistant-model-changed', sync)
    return () => {
      alive = false
      window.removeEventListener('nomi:assistant-model-changed', sync)
    }
  }, [])

  if (!loaded) {
    return <NomiSkeleton className={`h-7 w-[120px] ${className ?? ''}`} />
  }
  if (models.length === 0) return null

  const duplicateModelKeys = new Set(
    models
      .map((m) => m.modelKey)
      .filter((key, index, arr) => arr.indexOf(key) !== index),
  )

  const handleChange = (next: string) => {
    setModelKey(next)
    const picked = models.find((m) => modelOptionValue(m) === next)
    if (picked) setAssistantModelPref({ vendorKey: picked.vendorKey, modelKey: picked.modelKey })
  }

  return (
    <NomiSelect
      ariaLabel="助手模型"
      title="助手用哪个模型"
      size="xs"
      className={className}
      triggerMaxWidth={160}
      value={modelKey}
      options={models.map((m) => ({
        value: modelOptionValue(m),
        label: duplicateModelKeys.has(m.modelKey)
          ? `${m.labelZh || m.modelKey} (${m.vendorKey})`
          : (m.labelZh || m.modelKey),
      }))}
      onChange={handleChange}
    />
  )
}
