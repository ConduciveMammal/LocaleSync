import path from 'node:path'

import {Command, Flags} from '@oclif/core'

import {EXIT_CODE} from '../../../exit-codes.js'
import {exportLog, formatExportPath} from '../../../export-log.js'
import {formatExportConfirmation, formatSummary} from '../../../output.js'
import {syncLocales} from '../../../sync.js'
import {detectUi, quoteShellArgument} from '../../../ui.js'

export default class ThemeLocalesCheck extends Command {
  public static override description = 'Check whether locale files contain every key from the default locale.'

  public static override examples = [
    '<%= config.bin %> theme locales check',
    '<%= config.bin %> theme locales check --fail-on-differences',
    '<%= config.bin %> theme locales check --path ./path/to/theme --json',
  ]

  public static override flags = {
    'fail-on-differences': Flags.boolean({
      description: 'Exit with status 1 when locale files are out of sync.',
    }),
    export: Flags.string({
      description: 'Export the check result to a log file.',
      helpValue: '<file>',
    }),
    json: Flags.boolean({
      description: 'Output the result as JSON.',
    }),
    'no-color': Flags.boolean({
      description: 'Disable coloured output.',
    }),
    path: Flags.directory({
      default: process.cwd(),
      description: 'Path to the Shopify theme.',
      exists: true,
      noCacheDefault: true,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(ThemeLocalesCheck)
    const summary = await syncLocales({dryRun: true, root: flags.path})
    const ui = detectUi({noColor: flags['no-color']})
    const baseCommand = `${this.config.bin} theme locales sync`
    const nextCommand =
      path.resolve(flags.path) === process.cwd()
        ? baseCommand
        : `${baseCommand} --path ${quoteShellArgument(flags.path)}`

    const output = flags.json
      ? JSON.stringify(summary, null, 2)
      : formatSummary(summary, 'check', {...ui, nextCommand})
    this.log(output)

    if (flags.export) {
      const exportedFile = formatExportPath(flags.export)
      const terminalConfirmation = formatExportConfirmation(exportedFile, ui)
      await exportLog(flags.export, output)
      if (!flags.json) this.log(`\n${terminalConfirmation}`)
    }

    if (summary.conflicts.length > 0) {
      process.exitCode = EXIT_CODE.error
      return
    }

    if (flags['fail-on-differences'] && summary.totalChangedFiles > 0) {
      process.exitCode = EXIT_CODE.outOfSync
    }
  }
}
