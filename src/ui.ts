import picocolors from 'picocolors'

export interface UiOptions {
  color: boolean
  unicode: boolean
}

interface DetectUiOptions {
  noColor?: boolean
  stream?: NodeJS.WriteStream
}

export function detectUi(options: DetectUiOptions = {}): UiOptions {
  const stream = options.stream ?? process.stdout
  const isTty = Boolean(stream.isTTY)
  const noColor = options.noColor || 'NO_COLOR' in process.env || process.env.FORCE_COLOR === '0'
  const forceColor = process.env.FORCE_COLOR !== undefined && process.env.FORCE_COLOR !== '0'
  const supportsColor = !noColor && process.env.TERM !== 'dumb' && (forceColor || isTty)
  const locale = `${process.env.LC_ALL ?? ''}${process.env.LC_CTYPE ?? ''}${process.env.LANG ?? ''}`
  const supportsUnicode = isTty && process.env.TERM !== 'dumb' && /utf-?8/i.test(locale)

  return {
    color: supportsColor,
    unicode: supportsUnicode,
  }
}

export function resolveUi(options: Partial<UiOptions> = {}): UiOptions {
  const detected = detectUi()
  return {
    color: options.color ?? detected.color,
    unicode: options.unicode ?? detected.unicode,
  }
}

export function createStyles(options: UiOptions) {
  const color = picocolors.createColors(options.color)

  return {
    color,
    icon: {
      error: color.red(options.unicode ? '✖' : '[ERROR]'),
      info: color.cyan(options.unicode ? '●' : '[INFO]'),
      success: color.green(options.unicode ? '✔' : '[OK]'),
      warning: color.yellow(options.unicode ? '▲' : '[WARN]'),
    },
  }
}

export function formatCliError(error: unknown, options: Partial<UiOptions> = {}): string {
  const ui = resolveUi(options)
  const {color, icon} = createStyles(ui)
  const message = error instanceof Error ? error.message : String(error)

  return [
    `${icon.error} ${color.bold('LocaleSync could not complete the command.')}`,
    `  ${message}`,
    '',
    `${color.bold('Try:')} ${color.cyan('localesync --help')}`,
  ].join('\n')
}

export function quoteShellArgument(value: string): string {
  return /^[\w./-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`
}
