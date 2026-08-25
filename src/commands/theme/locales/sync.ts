import {Command, Flags} from '@oclif/core'

import {EXIT_CODE} from '../../../exit-codes.js'
import {exportLog, formatExportPath} from '../../../export-log.js'
import {formatExportConfirmation, formatSummary} from '../../../output.js'
import {syncLocales} from '../../../sync.js'
import {detectUi} from '../../../ui.js'

export default class ThemeLocalesSync extends Command {
  public static override description =
    'Add translations missing from other locale files using the default locale as the source.'

  public static override examples = [
    '<%= config.bin %> theme locales sync',
    '<%= config.bin %> theme locales sync --dry-run',
    '<%= config.bin %> theme locales sync --path ./path/to/theme --json',
  ]

  public static override flags = {
    'dry-run': Flags.boolean({
      description: 'Report changes without writing locale files.',
    }),
    export: Flags.string({
      description: 'Export the sync result to a log file.',
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
    const {flags} = await this.parse(ThemeLocalesSync)
    const summary = await syncLocales({dryRun: flags['dry-run'], root: flags.path})
    const ui = detectUi({noColor: flags['no-color']})

    const output = flags.json ? JSON.stringify(summary, null, 2) : formatSummary(summary, 'sync', ui)
    this.log(output)

    if (flags.export) {
      const exportedFile = formatExportPath(flags.export)
      const terminalConfirmation = formatExportConfirmation(exportedFile, ui)
      await exportLog(flags.export, output)
      if (!flags.json) this.log(`\n${terminalConfirmation}`)
    }

    if (summary.conflicts.length > 0) {
      process.exitCode = EXIT_CODE.error
    }
  }
}
