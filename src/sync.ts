import path from 'node:path'

import {backupLocaleFile} from './backup.js'
import {discoverLocaleGroups} from './discover.js'
import {applyJsonOperations, readJsonDocument, writeFileAtomically} from './json-document.js'
import {createMergePlan} from './merge.js'
import type {SyncOptions, SyncSummary} from './types.js'

export async function syncLocales(options: SyncOptions = {}): Promise<SyncSummary> {
  const root = path.resolve(options.root ?? process.cwd())
  const dryRun = options.dryRun ?? false
  const groups = await discoverLocaleGroups(root)
  const summary: SyncSummary = {
    conflicts: [],
    dryRun,
    files: [],
    groups: groups.map((group) => group.kind),
    root,
    totalAdded: 0,
    totalChangedFiles: 0,
    totalRemoved: 0,
  }

  for (const group of groups) {
    const source = await readJsonDocument(group.source)

    for (const targetPath of group.targets) {
      const target = await readJsonDocument(targetPath)
      const plan = createMergePlan(source.value, target.value)
      const changed = plan.operations.length > 0

      if (changed && !dryRun) {
        const updated = applyJsonOperations(target, plan.operations)
        await backupLocaleFile(root, targetPath, target.text)
        await writeFileAtomically(targetPath, updated)
      }

      summary.files.push({
        addedKeys: plan.addedKeys,
        changed,
        file: path.relative(root, targetPath),
        removedKeys: plan.removedKeys,
        source: path.relative(root, group.source),
      })
      summary.conflicts.push(
        ...plan.conflicts.map((conflict) => ({
          ...conflict,
          file: path.relative(root, targetPath),
        })),
      )
      summary.totalAdded += plan.addedKeys.length
      summary.totalRemoved += plan.removedKeys.length
      summary.totalChangedFiles += changed ? 1 : 0
    }
  }

  return summary
}
