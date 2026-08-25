export type JsonPrimitive = boolean | null | number | string
export type JsonValue = JsonArray | JsonObject | JsonPrimitive
export type JsonArray = JsonValue[]
export type JsonObject = {[key: string]: JsonValue}

export type LocaleGroupKind = 'schema' | 'storefront'

export interface LocaleGroup {
  kind: LocaleGroupKind
  source: string
  targets: string[]
}

export interface SyncConflict {
  file: string
  path: string
  reason: string
}

export interface SyncedFile {
  addedKeys: string[]
  changed: boolean
  file: string
  removedKeys: string[]
  source: string
}

export interface SyncSummary {
  conflicts: SyncConflict[]
  dryRun: boolean
  files: SyncedFile[]
  groups: LocaleGroupKind[]
  root: string
  totalAdded: number
  totalChangedFiles: number
  totalRemoved: number
}

export interface SyncOptions {
  dryRun?: boolean
  root?: string
}

export interface ResetSummary {
  files: string[]
  root: string
  totalRestored: number
}
