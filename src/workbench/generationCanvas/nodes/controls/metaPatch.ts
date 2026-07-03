function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function deepEquals(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => deepEquals(item, b[index]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a).filter((key) => a[key] !== undefined)
    const keysB = Object.keys(b).filter((key) => b[key] !== undefined)
    if (keysA.length !== keysB.length) return false
    return keysA.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEquals(a[key], b[key]))
  }
  return false
}

export function mergeMetaIfChanged(
  currentMeta: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> | null {
  const nextMeta = { ...currentMeta, ...patch }
  return deepEquals(currentMeta, nextMeta) ? null : nextMeta
}
