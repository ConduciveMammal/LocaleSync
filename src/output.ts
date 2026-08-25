import type {ResetSummary, SyncSummary} from './types.js'
import {createStyles, resolveUi, type UiOptions} from './ui.js'

interface KeyTreeNode {
  children: Map<string, KeyTreeNode>
}

function buildKeyTree(keys: string[]): KeyTreeNode {
  const root: KeyTreeNode = {children: new Map()}

  for (const key of keys) {
    let node = root
    for (const segment of key.split('.')) {
      let child = node.children.get(segment)
      if (!child) {
        child = {children: new Map()}
        node.children.set(segment, child)
      }

      node = child
    }
  }

  return root
}

function countLeaves(node: KeyTreeNode): number {
  if (node.children.size === 0) return 1
  return [...node.children.values()].reduce((total, child) => total + countLeaves(child), 0)
}

function formatPlainKeyTree(keys: string[], color: ReturnType<typeof createStyles>['color']): string[] {
  const root = buildKeyTree(keys)
  const lines: string[] = []

  function visit(node: KeyTreeNode, depth: number): void {
    for (const [segment, child] of node.children) {
      const indentation = '  '.repeat(depth)

      if (child.children.size === 0) {
        lines.push(`${indentation}- ${segment}`)
        continue
      }

      const leafCount = countLeaves(child)
      const count = leafCount > 1 ? color.dim(` (${leafCount})`) : ''
      lines.push(`${indentation}${color.cyan(segment)}${count}`)
      visit(child, depth + 1)
    }
  }

  visit(root, 1)
  return lines
}

function formatUnicodeKeyTree(keys: string[], color: ReturnType<typeof createStyles>['color']): string[] {
  const root = buildKeyTree(keys)
  const lines: string[] = []

  function visit(node: KeyTreeNode, prefix: string): void {
    const entries = [...node.children.entries()]

    entries.forEach(([segment, child], index) => {
      const isLast = index === entries.length - 1
      const connector = isLast ? '└─' : '├─'
      const continuation = isLast ? '  ' : '│ '

      if (child.children.size === 0) {
        lines.push(`  ${prefix}${connector} ${segment}`)
        return
      }

      const leafCount = countLeaves(child)
      const count = leafCount > 1 ? color.dim(` (${leafCount})`) : ''
      lines.push(`  ${prefix}${connector} ${color.cyan(segment)}${count}`)
      visit(child, `${prefix}${continuation} `)
    })
  }

  visit(root, '')
  return lines
}

interface FormatSummaryOptions extends Partial<UiOptions> {
  nextCommand?: string
}

export function formatResetSummary(
  summary: ResetSummary,
  options: FormatSummaryOptions = {},
): string {
  const ui = resolveUi(options)
  const {color, icon} = createStyles(ui)
  const lines = [`${color.bold('LocaleSync')} ${color.dim('reset')}`, '']

  if (summary.totalRestored === 0) {
    lines.push(`${icon.info} ${color.cyan('No locale backup was found.')}`)
  } else {
    lines.push(
      `${icon.success} ${color.green(`Restored ${summary.totalRestored} ${summary.totalRestored === 1 ? 'locale file' : 'locale files'}.`)}`,
      '',
      ...summary.files.map((file, index) => {
        const connector = ui.unicode ? (index === summary.files.length - 1 ? '└─' : '├─') : '-'
        return `  ${connector} ${file}`
      }),
    )
  }

  if (options.nextCommand) {
    lines.push('', `${color.bold('Next')}     ${color.cyan(options.nextCommand)}`)
  }

  return lines.join('\n')
}

export function formatExportConfirmation(
  file: string,
  options: Partial<UiOptions> = {},
): string {
  const ui = resolveUi(options)
  const {color, icon} = createStyles(ui)
  return `${icon.success} ${color.green('Exported log')}  ${file}`
}

export function formatSummary(
  summary: SyncSummary,
  mode: 'check' | 'sync',
  options: FormatSummaryOptions = {},
): string {
  const ui = resolveUi(options)
  const {color, icon} = createStyles(ui)
  const lines: string[] = []
  const changedFiles = summary.files.filter((file) => file.changed)
  const hasConflicts = summary.conflicts.length > 0
  const changesWereWritten = mode === 'sync' && !summary.dryRun
  const addedLabel = changesWereWritten ? 'Added' : 'Missing'
  const removedLabel = changesWereWritten ? 'Removed' : 'Additional'

  lines.push(`${color.bold('LocaleSync')} ${color.dim(mode)}`, '')

  if (hasConflicts) {
    const message = changesWereWritten
      ? 'Locale files were updated, but structural conflicts remain.'
      : 'Locale files contain structural conflicts.'
    lines.push(`${icon.error} ${color.red(message)}`)
  } else if (changedFiles.length === 0) {
    lines.push(`${icon.success} ${color.green('Locale files are in sync.')}`)
  } else {
    const status =
      mode === 'check'
        ? {icon: icon.warning, message: color.yellow('Locale files are out of sync.')}
        : summary.dryRun
          ? {icon: icon.info, message: color.cyan('Locale files would be updated.')}
          : {icon: icon.success, message: color.green('Locale files synchronised.')}
    lines.push(`${status.icon} ${status.message}`)

    for (const file of changedFiles) {
      const formatKeyTree = ui.unicode ? formatUnicodeKeyTree : formatPlainKeyTree
      const addedTree = formatKeyTree(file.addedKeys, color)
      const removedTree = formatKeyTree(file.removedKeys, color)
      const hasAdded = file.addedKeys.length > 0
      const hasRemoved = file.removedKeys.length > 0

      lines.push(
        '',
        color.bold(file.file),
        `  ${color.dim('Source')}   ${file.source}`,
      )

      if (hasAdded) {
        lines.push(
          `  ${color.dim(addedLabel)}${' '.repeat(12 - addedLabel.length)}${file.addedKeys.length} ${file.addedKeys.length === 1 ? 'key' : 'keys'}`,
        )
      }

      if (hasRemoved) {
        lines.push(
          `  ${color.dim(removedLabel)}${' '.repeat(12 - removedLabel.length)}${file.removedKeys.length} ${file.removedKeys.length === 1 ? 'key' : 'keys'}`,
        )
      }

      if (hasAdded && hasRemoved) {
        lines.push('', `  ${color.bold(addedLabel)}`, ...addedTree, '', `  ${color.bold(removedLabel)}`, ...removedTree)
      } else {
        lines.push('', ...(hasAdded ? addedTree : removedTree))
      }
    }

    const changeParts = [
      summary.totalAdded > 0
        ? `${summary.totalAdded} ${changesWereWritten ? 'added' : 'missing'}`
        : undefined,
      summary.totalRemoved > 0
        ? `${summary.totalRemoved} ${changesWereWritten ? 'removed' : 'additional'}`
        : undefined,
    ].filter((part): part is string => part !== undefined)

    lines.push(
      '',
      `${color.bold('Summary')}  ${changeParts.join(', ')} ${summary.totalAdded + summary.totalRemoved === 1 ? 'key' : 'keys'} across ${summary.totalChangedFiles} ${summary.totalChangedFiles === 1 ? 'file' : 'files'}.`,
    )

    if (mode === 'check' && options.nextCommand && !hasConflicts) {
      lines.push(`${color.bold('Next')}     ${color.cyan(options.nextCommand)}`)
    }
  }

  if (summary.conflicts.length > 0) {
    lines.push(
      '',
      `${icon.error} ${color.red(`${summary.conflicts.length} structural ${summary.conflicts.length === 1 ? 'conflict' : 'conflicts'}`)}`,
    )
    for (const conflict of summary.conflicts) {
      lines.push(`  ${color.bold(conflict.file)}  ${conflict.path}`, `    ${conflict.reason}`)
    }

    lines.push('', `${color.bold('Next')}     Resolve the conflicting structures, then run the check again.`)
  }

  return lines.join('\n')
}
