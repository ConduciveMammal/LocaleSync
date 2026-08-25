import type {JsonObject, JsonValue, SyncConflict} from './types.js'
import type {JsonOperation} from './json-document.js'

export interface MergePlan {
  addedKeys: string[]
  conflicts: Omit<SyncConflict, 'file'>[]
  operations: JsonOperation[]
  removedKeys: string[]
}

const pluralCategories = new Set(['few', 'many', 'one', 'other', 'two', 'zero'])

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function displayPath(segments: string[]): string {
  return segments.join('.')
}

function collectLeafKeys(value: JsonValue, path: string[]): string[] {
  if (!isJsonObject(value) || Object.keys(value).length === 0) {
    return [displayPath(path)]
  }

  return Object.entries(value).flatMap(([key, child]) => collectLeafKeys(child, [...path, key]))
}

function hasPluralCategories(value: JsonObject): boolean {
  return Object.entries(value).some(
    ([key, child]) => pluralCategories.has(key) && !isJsonObject(child),
  )
}

export function createMergePlan(source: JsonObject, target: JsonObject): MergePlan {
  const plan: MergePlan = {
    addedKeys: [],
    conflicts: [],
    operations: [],
    removedKeys: [],
  }

  function visit(sourceObject: JsonObject, targetObject: JsonObject, parentPath: string[]): void {
    const isPluralisationContext =
      hasPluralCategories(sourceObject) || hasPluralCategories(targetObject)

    for (const [key, sourceValue] of Object.entries(sourceObject)) {
      if (isPluralisationContext && pluralCategories.has(key)) continue

      const keyPath = [...parentPath, key]

      if (!Object.hasOwn(targetObject, key)) {
        plan.operations.push({path: keyPath, value: sourceValue})
        plan.addedKeys.push(...collectLeafKeys(sourceValue, keyPath))
        continue
      }

      const targetValue = targetObject[key] as JsonValue
      const sourceIsObject = isJsonObject(sourceValue)
      const targetIsObject = isJsonObject(targetValue)

      if (sourceIsObject && targetIsObject) {
        visit(sourceValue, targetValue, keyPath)
        continue
      }

      if (sourceIsObject !== targetIsObject) {
        plan.conflicts.push({
          path: displayPath(keyPath),
          reason: 'The default and target locales use different value structures.',
        })
      }
    }

    for (const [key, targetValue] of Object.entries(targetObject)) {
      if (isPluralisationContext && pluralCategories.has(key)) continue
      if (Object.hasOwn(sourceObject, key)) continue

      const keyPath = [...parentPath, key]
      plan.operations.push({path: keyPath, value: undefined})
      plan.removedKeys.push(...collectLeafKeys(targetValue, keyPath))
    }
  }

  visit(source, target, [])
  return plan
}
