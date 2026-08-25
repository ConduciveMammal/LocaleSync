import {readFile, rename, stat, unlink, writeFile, chmod} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import path from 'node:path'

import {
  applyEdits,
  modify,
  parse,
  printParseErrorCode,
  type FormattingOptions,
  type ParseError,
} from 'jsonc-parser'

import {LocaleSyncError} from './errors.js'
import type {JsonObject, JsonValue} from './types.js'

export interface JsonDocument {
  formatting: FormattingOptions
  hasFinalNewline: boolean
  text: string
  value: JsonObject
}

export interface JsonOperation {
  path: string[]
  value: JsonValue | undefined
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function inferFormatting(text: string): FormattingOptions {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const indentation = text.match(/^[\t ]+(?="[^"\r\n]+"\s*:)/m)?.[0] ?? '  '

  return {
    eol,
    insertSpaces: !indentation.includes('\t'),
    tabSize: indentation.includes('\t') ? 1 : indentation.length,
  }
}

export async function readJsonDocument(file: string): Promise<JsonDocument> {
  const text = await readFile(file, 'utf8')
  const errors: ParseError[] = []
  const value: unknown = parse(text, errors, {allowTrailingComma: true})

  if (errors.length > 0) {
    const firstError = errors[0] as ParseError
    throw new LocaleSyncError(
      `Could not parse ${file}: ${printParseErrorCode(firstError.error)} at offset ${firstError.offset}.`,
    )
  }

  if (!isJsonObject(value)) {
    throw new LocaleSyncError(`Expected ${file} to contain a JSON object at its root.`)
  }

  return {
    formatting: inferFormatting(text),
    hasFinalNewline: text.endsWith('\n'),
    text,
    value,
  }
}

export function applyJsonOperations(document: JsonDocument, operations: JsonOperation[]): string {
  let updated = document.text

  for (const operation of operations) {
    updated = applyEdits(
      updated,
      modify(updated, operation.path, operation.value, {
        formattingOptions: document.formatting,
      }),
    )
  }

  if (document.hasFinalNewline && !updated.endsWith('\n')) {
    return `${updated}${document.formatting.eol}`
  }

  return updated
}

export async function writeFileAtomically(file: string, contents: string): Promise<void> {
  const temporaryFile = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`)
  const fileMode = await stat(file)
    .then((fileStat) => fileStat.mode)
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined
      throw error
    })

  try {
    await writeFile(temporaryFile, contents, 'utf8')
    if (fileMode !== undefined) await chmod(temporaryFile, fileMode)
    await rename(temporaryFile, file)
  } catch (error) {
    await unlink(temporaryFile).catch(() => undefined)
    throw error
  }
}
