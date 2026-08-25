import {parseArgs} from 'node:util'

import {EXIT_CODE} from './exit-codes.js'
import {exportLog, formatExportPath} from './export-log.js'
import {formatHelp, VERSION} from './help.js'
import {formatExportConfirmation, formatResetSummary, formatSummary} from './output.js'
import {resetLocales} from './reset.js'
import {syncLocales} from './sync.js'
import {detectUi, formatCliError, quoteShellArgument} from './ui.js'

export async function runStandalone(argv: string[]): Promise<void> {
  const {positionals, values} = parseArgs({
    allowPositionals: true,
    args: argv,
    options: {
      'dry-run': {type: 'boolean'},
      'fail-on-differences': {type: 'boolean'},
      export: {type: 'string'},
      help: {short: 'h', type: 'boolean'},
      json: {type: 'boolean'},
      'no-color': {type: 'boolean'},
      path: {type: 'string'},
      version: {short: 'v', type: 'boolean'},
    },
    strict: true,
  })

  const ui = detectUi({noColor: values['no-color']})

  if (values.version) {
    process.stdout.write(`${VERSION}\n`)
    return
  }

  if (values.help || positionals.length === 0) {
    process.stdout.write(`${formatHelp(ui)}\n`)
    return
  }

  const command = positionals[0]
  if ((command !== 'sync' && command !== 'check' && command !== 'reset') || positionals.length > 1) {
    throw new Error(`Unknown command: ${positionals.join(' ')}`)
  }

  if (command !== 'sync' && values['dry-run']) {
    throw new Error('--dry-run is only available with the sync command.')
  }

  if (command !== 'check' && values['fail-on-differences']) {
    throw new Error('--fail-on-differences is only available with the check command.')
  }

  if (command === 'reset' && values.export) {
    throw new Error('--export is only available with the check and sync commands.')
  }

  const nextCommand = `localesync sync${values.path ? ` --path ${quoteShellArgument(values.path)}` : ''}`

  if (command === 'reset') {
    const summary = await resetLocales(values.path)
    const output = values.json
      ? JSON.stringify(summary, null, 2)
      : formatResetSummary(summary, {...ui, nextCommand})
    process.stdout.write(`${output}\n`)
    return
  }

  const summary = await syncLocales({
    dryRun: command === 'check' || values['dry-run'],
    root: values.path,
  })
  const output = values.json
    ? JSON.stringify(summary, null, 2)
    : formatSummary(summary, command, {...ui, nextCommand})
  process.stdout.write(`${output}\n`)

  if (values.export) {
    const exportedFile = formatExportPath(values.export)
    const terminalConfirmation = formatExportConfirmation(exportedFile, ui)
    await exportLog(values.export, output)
    if (!values.json) {
      process.stdout.write(`\n${terminalConfirmation}\n`)
    }
  }

  if (summary.conflicts.length > 0) {
    process.exitCode = EXIT_CODE.error
  } else if (
    command === 'check' &&
    values['fail-on-differences'] &&
    summary.totalChangedFiles > 0
  ) {
    process.exitCode = EXIT_CODE.outOfSync
  }
}

export async function runStandaloneMain(argv: string[]): Promise<void> {
  try {
    await runStandalone(argv)
  } catch (error) {
    const ui = detectUi({noColor: argv.includes('--no-color'), stream: process.stderr})
    process.stderr.write(`${formatCliError(error, ui)}\n`)
    process.exitCode = EXIT_CODE.error
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runStandaloneMain(process.argv.slice(2))
}
