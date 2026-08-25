import {mkdir, readFile, readdir, rm, rmdir, writeFile} from 'node:fs/promises'
import path from 'node:path'

import {LocaleSyncError} from './errors.js'
import {writeFileAtomically} from './json-document.js'
import type {ResetSummary} from './types.js'

const STATE_DIRECTORY = path.join('node_modules', '.cache', 'localesync')
const LEGACY_STATE_DIRECTORY = '.localesync'
const BACKUP_DIRECTORY = 'backups'

function backupRoot(root: string): string {
  return path.join(root, STATE_DIRECTORY, BACKUP_DIRECTORY)
}

function legacyBackupRoot(root: string): string {
  return path.join(root, LEGACY_STATE_DIRECTORY, BACKUP_DIRECTORY)
}

function safeRelativeLocalePath(root: string, file: string): string {
  const relativePath = path.relative(root, file)
  const [topLevelDirectory] = relativePath.split(path.sep)

  if (
    relativePath === '' ||
    path.isAbsolute(relativePath) ||
    relativePath.startsWith(`..${path.sep}`) ||
    topLevelDirectory !== 'locales'
  ) {
    throw new LocaleSyncError(`Refusing to back up a file outside the theme's locales directory: ${file}.`)
  }

  return relativePath
}

export async function backupLocaleFile(root: string, file: string, contents: string): Promise<void> {
  await migrateLegacyBackups(root)

  const relativePath = safeRelativeLocalePath(root, file)
  const backupFile = path.join(backupRoot(root), relativePath)

  await mkdir(path.dirname(backupFile), {recursive: true})

  try {
    await writeFile(backupFile, contents, {encoding: 'utf8', flag: 'wx'})
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  }
}

async function listBackupFiles(directory: string): Promise<string[]> {
  let entries

  try {
    entries = await readdir(directory, {withFileTypes: true})
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }

  const files: string[] = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await listBackupFiles(entryPath)))
    else if (entry.isFile()) files.push(entryPath)
  }

  return files
}

async function migrateLegacyBackups(root: string): Promise<void> {
  const legacyDirectory = legacyBackupRoot(root)
  const legacyFiles = await listBackupFiles(legacyDirectory)

  if (legacyFiles.length === 0) return

  for (const legacyFile of legacyFiles) {
    const relativePath = path.relative(legacyDirectory, legacyFile)
    const backupFile = path.join(backupRoot(root), relativePath)

    await mkdir(path.dirname(backupFile), {recursive: true})

    try {
      await writeFile(backupFile, await readFile(legacyFile, 'utf8'), {encoding: 'utf8', flag: 'wx'})
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }

  await rm(path.join(root, LEGACY_STATE_DIRECTORY), {force: true, recursive: true})
}

export async function resetLocales(rootPath: string = process.cwd()): Promise<ResetSummary> {
  const root = path.resolve(rootPath)
  await migrateLegacyBackups(root)

  const backupsDirectory = backupRoot(root)
  const backupFiles = await listBackupFiles(backupsDirectory)
  const restoredFiles: string[] = []

  for (const backupFile of backupFiles) {
    const relativePath = path.relative(backupsDirectory, backupFile)
    const destination = path.join(root, relativePath)
    safeRelativeLocalePath(root, destination)

    await mkdir(path.dirname(destination), {recursive: true})
    await writeFileAtomically(destination, await readFile(backupFile, 'utf8'))
    restoredFiles.push(relativePath)
  }

  if (backupFiles.length > 0) {
    await rm(backupsDirectory, {force: true, recursive: true})
    await rmdir(path.join(root, STATE_DIRECTORY)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY') throw error
    })
  }

  return {
    files: restoredFiles,
    root,
    totalRestored: restoredFiles.length,
  }
}
