import {readdir} from 'node:fs/promises'
import path from 'node:path'

import {LocaleSyncError} from './errors.js'
import type {LocaleGroup, LocaleGroupKind} from './types.js'

function requireSingleDefault(kind: LocaleGroupKind, files: string[], localesDirectory: string): string {
  if (files.length === 0) {
    throw new LocaleSyncError(`No default ${kind} locale file was found in ${localesDirectory}.`)
  }

  if (files.length > 1) {
    throw new LocaleSyncError(
      `Expected one default ${kind} locale file in ${localesDirectory}, but found: ${files.join(', ')}.`,
    )
  }

  return files[0] as string
}

export async function discoverLocaleGroups(root: string): Promise<LocaleGroup[]> {
  const localesDirectory = path.join(root, 'locales')
  let entries

  try {
    entries = await readdir(localesDirectory, {withFileTypes: true})
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new LocaleSyncError(`No locales directory was found at ${localesDirectory}.`)
    }

    throw error
  }

  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

  const storefrontDefaults = files.filter(
    (file) => file.endsWith('.default.json') && !file.endsWith('.default.schema.json'),
  )
  const storefrontSource = requireSingleDefault('storefront', storefrontDefaults, localesDirectory)
  const storefrontTargets = files.filter(
    (file) => file.endsWith('.json') && !file.endsWith('.schema.json') && !file.endsWith('.default.json'),
  )

  const groups: LocaleGroup[] = [
    {
      kind: 'storefront',
      source: path.join(localesDirectory, storefrontSource),
      targets: storefrontTargets.map((file) => path.join(localesDirectory, file)),
    },
  ]

  const schemaDefaults = files.filter((file) => file.endsWith('.default.schema.json'))
  const schemaTargets = files.filter(
    (file) => file.endsWith('.schema.json') && !file.endsWith('.default.schema.json'),
  )

  if (schemaDefaults.length > 0 || schemaTargets.length > 0) {
    const schemaSource = requireSingleDefault('schema', schemaDefaults, localesDirectory)
    groups.push({
      kind: 'schema',
      source: path.join(localesDirectory, schemaSource),
      targets: schemaTargets.map((file) => path.join(localesDirectory, file)),
    })
  }

  return groups
}
