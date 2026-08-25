import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

import {createStyles, resolveUi, type UiOptions} from './ui.js'

interface PackageJson {
  version: string
}

const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url))
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson

export const VERSION = packageJson.version

export function formatHelp(options: Partial<UiOptions> = {}): string {
  const ui = resolveUi(options)
  const {color} = createStyles(ui)
  const section = (label: string) => color.bold(color.yellow(label))

  return [
    `${color.bold('LocaleSync')} ${color.dim(`v${VERSION}`)}`,
    'Keep Shopify theme locale files structurally in sync.',
    '',
    section('USAGE'),
    '  localesync <command> [options]',
    '',
    section('COMMANDS'),
    `  ${color.cyan('sync')}   Add missing keys without overwriting existing translations.`,
    `  ${color.cyan('check')}  Report differences without changing locale files.`,
    `  ${color.cyan('reset')}  Restore locale files to their state before the first sync.`,
    '',
    section('OPTIONS'),
    '  --path <theme>  Path to the Shopify theme. Defaults to the current directory.',
    '  --dry-run       Report sync changes without writing files.',
    '  --fail-on-differences',
    '                  Exit with status 1 when check finds differences.',
    '  --export <file> Export the check or sync result to a log file.',
    '  --json          Output machine-readable JSON.',
    '  --no-color      Disable coloured output.',
    '  -h, --help      Show help.',
    '  -v, --version   Show the LocaleSync version.',
    '',
    section('EXAMPLES'),
    `  ${color.dim('# Synchronise the current theme')}`,
    '  localesync sync',
    '',
    `  ${color.dim('# Preview changes in another theme')}`,
    '  localesync sync --path ./themes/example --dry-run',
    '',
    `  ${color.dim('# Fail CI when locale keys are missing')}`,
    '  localesync check --fail-on-differences --json',
    '',
    `  ${color.dim('# Export a portable sync log')}`,
    '  localesync sync --dry-run --export ./reports/localesync.log',
    '',
    `  ${color.dim('# Restore files and repeat the sync workflow')}`,
    '  localesync reset',
    '',
    section('ENVIRONMENT'),
    '  NO_COLOR=1       Disable coloured output.',
    '  FORCE_COLOR=1    Force coloured output when stdout is not a TTY.',
  ].join('\n')
}
