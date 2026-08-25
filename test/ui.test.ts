import {describe, expect, it} from 'vitest'

import {formatHelp} from '../src/help.js'
import {formatCliError, quoteShellArgument} from '../src/ui.js'

describe('CLI UI', () => {
  it('provides commands, options, examples, and environment help', () => {
    const output = formatHelp({color: false, unicode: false})

    expect(output).toContain('USAGE')
    expect(output).toContain('COMMANDS')
    expect(output).toContain('reset  Restore locale files')
    expect(output).toContain('--no-color')
    expect(output).toContain('--fail-on-differences')
    expect(output).toContain('--export <file>')
    expect(output).toContain('EXAMPLES')
    expect(output).toContain('NO_COLOR=1')
  })

  it('formats actionable errors without a stack trace', () => {
    expect(formatCliError(new Error('Unknown command: syn'), {color: false, unicode: false})).toBe(
      [
        '[ERROR] LocaleSync could not complete the command.',
        '  Unknown command: syn',
        '',
        'Try: localesync --help',
      ].join('\n'),
    )
  })

  it('quotes paths safely in suggested commands', () => {
    expect(quoteShellArgument('./themes/example')).toBe('./themes/example')
    expect(quoteShellArgument('./themes/My example')).toBe("'./themes/My example'")
  })
})
