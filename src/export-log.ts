import {mkdir} from 'node:fs/promises'
import path from 'node:path'
import {stripVTControlCharacters} from 'node:util'

import {writeFileAtomically} from './json-document.js'

export function formatExportPath(file: string): string {
  const resolvedFile = path.resolve(file)
  const relativeFile = path.relative(process.cwd(), resolvedFile)
  return relativeFile.startsWith('..') ? resolvedFile : relativeFile
}

export async function exportLog(file: string, contents: string): Promise<string> {
  const resolvedFile = path.resolve(file)
  const plainContents = stripVTControlCharacters(contents)
  await mkdir(path.dirname(resolvedFile), {recursive: true})
  await writeFileAtomically(resolvedFile, `${plainContents.replace(/\s+$/, '')}\n`)
  return formatExportPath(file)
}
