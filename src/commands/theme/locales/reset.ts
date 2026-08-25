import path from 'node:path'

import {Command, Flags} from '@oclif/core'

import {formatResetSummary} from '../../../output.js'
import {resetLocales} from '../../../reset.js'
import {detectUi, quoteShellArgument} from '../../../ui.js'

export default class ThemeLocalesReset extends Command {
  public static override description = 'Restore locale files to their state before the first LocaleSync sync.'

  public static override examples = [
    '<%= config.bin %> theme locales reset',
    '<%= config.bin %> theme locales reset --path ./path/to/theme --json',
  ]

  public static override flags = {
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
    const {flags} = await this.parse(ThemeLocalesReset)
    const summary = await resetLocales(flags.path)
    const ui = detectUi({noColor: flags['no-color']})
    const baseCommand = `${this.config.bin} theme locales sync`
    const nextCommand =
      path.resolve(flags.path) === process.cwd()
        ? baseCommand
        : `${baseCommand} --path ${quoteShellArgument(flags.path)}`

    this.log(
      flags.json
        ? JSON.stringify(summary, null, 2)
        : formatResetSummary(summary, {...ui, nextCommand}),
    )
  }
}
