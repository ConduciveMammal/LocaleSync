import {mkdtemp, readFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {afterEach, describe, expect, it} from 'vitest'

import {exportLog} from '../src/export-log.js'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, {force: true, recursive: true})))
})

describe('exportLog', () => {
  it('creates parent directories and writes a final newline', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'localesync-export-'))
    temporaryRoots.push(root)
    const file = path.join(root, 'reports', 'check.log')

    await exportLog(
      file,
      '\u001B[1mLocaleSync check\u001B[22m\n\n[OK] Locale files are in sync.\n\n',
    )

    await expect(readFile(file, 'utf8')).resolves.toBe(
      'LocaleSync check\n\n[OK] Locale files are in sync.\n',
    )
  })
})
