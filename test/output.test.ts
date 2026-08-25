import {describe, expect, it} from 'vitest'

import {formatResetSummary, formatSummary} from '../src/output.js'
import type {SyncSummary} from '../src/types.js'

const summary: SyncSummary = {
  conflicts: [],
  dryRun: true,
  files: [
    {
      addedKeys: [
        'header.search_bar.search_prefix',
        'header.search_bar.animated_search_terms',
        'cart.general.subtotal',
      ],
      changed: true,
      file: 'locales/es.json',
      removedKeys: [],
      source: 'locales/en.default.json',
    },
  ],
  groups: ['storefront'],
  root: '/theme',
  totalAdded: 3,
  totalChangedFiles: 1,
  totalRemoved: 0,
}

describe('formatSummary', () => {
  it('groups missing keys into a readable namespace tree', () => {
    expect(
      formatSummary(summary, 'check', {
        color: false,
        nextCommand: 'localesync sync',
        unicode: false,
      }),
    ).toMatchInlineSnapshot(`
      "LocaleSync check

      [WARN] Locale files are out of sync.

      locales/es.json
        Source   locales/en.default.json
        Missing     3 keys

        header (2)
          search_bar (2)
            - search_prefix
            - animated_search_terms
        cart
          general
            - subtotal

      Summary  3 missing keys across 1 file.
      Next     localesync sync"
    `)
  })

  it('uses tree guides in supported terminals', () => {
    const output = formatSummary(summary, 'check', {color: false, unicode: true})

    expect(output).toContain('  ├─ header (2)')
    expect(output).toContain('  │  └─ search_bar (2)')
    expect(output).toContain('  └─ cart')
  })

  it('uses ANSI colour only when enabled', () => {
    expect(formatSummary(summary, 'check', {color: true, unicode: false})).toContain('\u001B[')
    expect(formatSummary(summary, 'check', {color: false, unicode: false})).not.toContain('\u001B[')
  })

  it('uses a concise message when no changes are needed', () => {
    expect(
      formatSummary(
        {...summary, files: [], totalAdded: 0, totalChangedFiles: 0},
        'check',
      ),
    ).toBe('LocaleSync check\n\n[OK] Locale files are in sync.')
  })

  it('does not report success when structural conflicts remain', () => {
    const output = formatSummary(
      {
        ...summary,
        conflicts: [
          {
            file: 'locales/es.json',
            path: 'cart.item_count',
            reason: 'The default and target locales use different value structures.',
          },
        ],
        files: [],
        totalAdded: 0,
        totalChangedFiles: 0,
      },
      'check',
      {color: false, unicode: false},
    )

    expect(output).toContain('[ERROR] Locale files contain structural conflicts.')
    expect(output).not.toContain('[OK]')
    expect(output).toContain('Resolve the conflicting structures, then run the check again.')
  })

  it('formats reset results with the next sync command', () => {
    expect(
      formatResetSummary(
        {
          files: ['locales/es.json', 'locales/es.schema.json'],
          root: '/theme',
          totalRestored: 2,
        },
        {color: false, nextCommand: 'localesync sync', unicode: false},
      ),
    ).toMatchInlineSnapshot(`
      "LocaleSync reset

      [OK] Restored 2 locale files.

        - locales/es.json
        - locales/es.schema.json

      Next     localesync sync"
    `)
  })
})
