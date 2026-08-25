import {access, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {afterEach, describe, expect, it} from 'vitest'

import {LocaleSyncError, resetLocales, syncLocales} from '../src/index.js'

const temporaryRoots: string[] = []

async function createTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'localesync-'))
  temporaryRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, {force: true, recursive: true})))
})

async function createTheme(root: string, files: Record<string, string>): Promise<void> {
  const localesDirectory = path.join(root, 'locales')
  await mkdir(localesDirectory, {recursive: true})

  await Promise.all(
    Object.entries(files).map(([file, contents]) => writeFile(path.join(localesDirectory, file), contents, 'utf8')),
  )
}

describe('syncLocales', () => {
  it('adds missing storefront and schema keys without overwriting translations', async () => {
    const root = await createTemporaryRoot()
    await createTheme(root, {
      'en.default.json': JSON.stringify({general: {cancel: 'Cancel', save: 'Save'}}, null, 2),
      'en.default.schema.json': JSON.stringify({sections: {header: {name: 'Header'}}}, null, 2),
      'fr.json': JSON.stringify({general: {save: 'Enregistrer'}}, null, 2),
      'fr.schema.json': JSON.stringify({sections: {}}, null, 2),
    })

    const summary = await syncLocales({root})
    const storefront = JSON.parse(await readFile(path.join(root, 'locales/fr.json'), 'utf8')) as unknown
    const schema = JSON.parse(await readFile(path.join(root, 'locales/fr.schema.json'), 'utf8')) as unknown

    expect(summary.totalAdded).toBe(2)
    expect(summary.totalRemoved).toBe(0)
    expect(summary.totalChangedFiles).toBe(2)
    expect(storefront).toEqual({general: {save: 'Enregistrer', cancel: 'Cancel'}})
    expect(schema).toEqual({sections: {header: {name: 'Header'}}})
  })

  it('reports changes without writing during a dry run', async () => {
    const root = await createTemporaryRoot()
    const target = '{\n  "general": {}\n}\n'
    await createTheme(root, {
      'en.default.json': '{\n  "general": {"save": "Save"}\n}\n',
      'fr.json': target,
    })

    const summary = await syncLocales({dryRun: true, root})

    expect(summary.totalAdded).toBe(1)
    expect(await readFile(path.join(root, 'locales/fr.json'), 'utf8')).toBe(target)
    await expect(access(path.join(root, '.localesync'))).rejects.toMatchObject({code: 'ENOENT'})
    await expect(access(path.join(root, 'node_modules/.cache/localesync'))).rejects.toMatchObject({code: 'ENOENT'})
  })

  it('removes keys that no longer exist in the default locale', async () => {
    const root = await createTemporaryRoot()
    await createTheme(root, {
      'en.default.json': JSON.stringify({product: {form: {sold_out_1: 'Sold out'}}}, null, 2),
      'es.json': JSON.stringify({product: {form: {sold_out: 'Agotado'}}}, null, 2),
    })

    const summary = await syncLocales({root})
    const target = JSON.parse(await readFile(path.join(root, 'locales/es.json'), 'utf8')) as unknown

    expect(summary.totalAdded).toBe(1)
    expect(summary.totalRemoved).toBe(1)
    expect(summary.files[0]).toMatchObject({
      addedKeys: ['product.form.sold_out_1'],
      removedKeys: ['product.form.sold_out'],
    })
    expect(target).toEqual({product: {form: {sold_out_1: 'Sold out'}}})
  })

  it('preserves locale-specific plural categories', async () => {
    const root = await createTemporaryRoot()
    await createTheme(root, {
      'en.default.json': JSON.stringify({products: {count: {one: '{{ count }} product', other: '{{ count }} products'}}}),
      'fr.json': JSON.stringify({products: {count: {few: '{{ count }} produits', many: '{{ count }} produits', one: '{{ count }} produit', other: '{{ count }} produits'}}}),
    })

    const original = await readFile(path.join(root, 'locales/fr.json'), 'utf8')
    const summary = await syncLocales({root})

    expect(summary.totalAdded).toBe(0)
    expect(summary.totalRemoved).toBe(0)
    expect(summary.totalChangedFiles).toBe(0)
    expect(await readFile(path.join(root, 'locales/fr.json'), 'utf8')).toBe(original)
  })

  it('synchronises ordinary keys nested beside plural categories', async () => {
    const root = await createTemporaryRoot()
    await createTheme(root, {
      'en.default.json': JSON.stringify({
        cart: {item_count: {one: '{{ count }} item', other: '{{ count }} items', sold_out: 'Sold out'}},
      }),
      'es.json': JSON.stringify({cart: {item_count: {one: '{{ count }} artículo'}}}),
    })

    const summary = await syncLocales({root})
    const target = JSON.parse(await readFile(path.join(root, 'locales/es.json'), 'utf8')) as {
      cart: {item_count: Record<string, string>}
    }

    expect(summary.conflicts).toEqual([])
    expect(summary.files[0]).toMatchObject({
      addedKeys: ['cart.item_count.sold_out'],
      removedKeys: [],
    })
    expect(target.cart.item_count).toEqual({
      one: '{{ count }} artículo',
      sold_out: 'Sold out',
    })
  })

  it('preserves comments and trailing commas when adding keys', async () => {
    const root = await createTemporaryRoot()
    await createTheme(root, {
      'en.default.json': '{\n  "general": {\n    "save": "Save",\n    "cancel": "Cancel"\n  }\n}\n',
      'fr.json': '/* Managed by Shopify */\n{\n  "general": {\n    "save": "Enregistrer",\n  },\n}\n',
    })

    await syncLocales({root})
    const updated = await readFile(path.join(root, 'locales/fr.json'), 'utf8')

    expect(updated).toContain('/* Managed by Shopify */')
    expect(updated).toContain('"save": "Enregistrer"')
    expect(updated).toContain('"cancel": "Cancel"')
  })

  it('reports structural conflicts without overwriting the target', async () => {
    const root = await createTemporaryRoot()
    await createTheme(root, {
      'en.default.json': JSON.stringify({products: {count: {one: 'One', other: 'Many'}}}),
      'fr.json': JSON.stringify({products: {count: 'Produits'}}),
    })

    const summary = await syncLocales({root})

    expect(summary.conflicts).toEqual([
      {
        file: 'locales/fr.json',
        path: 'products.count',
        reason: 'The default and target locales use different value structures.',
      },
    ])
    expect(JSON.parse(await readFile(path.join(root, 'locales/fr.json'), 'utf8'))).toEqual({
      products: {count: 'Produits'},
    })
  })

  it('requires exactly one default storefront locale', async () => {
    const root = await createTemporaryRoot()
    await createTheme(root, {'fr.json': '{}'})

    await expect(syncLocales({root})).rejects.toThrow(LocaleSyncError)
  })

  it('restores the exact pre-sync baseline and clears it after reset', async () => {
    const root = await createTemporaryRoot()
    const targetFile = path.join(root, 'locales/fr.json')
    const sourceFile = path.join(root, 'locales/en.default.json')
    const original = '/* Original formatting */\n{\n\t"general": {}\n}\n'
    await createTheme(root, {
      'en.default.json': JSON.stringify({general: {save: 'Save'}}, null, 2),
      'fr.json': original,
    })

    await syncLocales({root})
    expect(await readFile(path.join(root, 'node_modules/.cache/localesync/backups/locales/fr.json'), 'utf8')).toBe(
      original,
    )
    await expect(access(path.join(root, '.localesync'))).rejects.toMatchObject({code: 'ENOENT'})
    await writeFile(sourceFile, JSON.stringify({general: {cancel: 'Cancel', save: 'Save'}}, null, 2), 'utf8')
    await syncLocales({root})

    expect(await readFile(targetFile, 'utf8')).toContain('"cancel": "Cancel"')

    const summary = await resetLocales(root)

    expect(summary.files).toEqual(['locales/fr.json'])
    expect(summary.totalRestored).toBe(1)
    expect(await readFile(targetFile, 'utf8')).toBe(original)
    await expect(access(path.join(root, '.localesync'))).rejects.toMatchObject({code: 'ENOENT'})
    await expect(access(path.join(root, 'node_modules/.cache/localesync'))).rejects.toMatchObject({code: 'ENOENT'})
    await expect(resetLocales(root)).resolves.toMatchObject({files: [], totalRestored: 0})
  })

  it('migrates legacy project-root backups before resetting', async () => {
    const root = await createTemporaryRoot()
    const original = '{"general":{"save":"Enregistrer"}}\n'
    await createTheme(root, {
      'en.default.json': '{"general":{"save":"Save"}}\n',
      'fr.json': '{"general":{"save":"Save"}}\n',
    })
    await mkdir(path.join(root, '.localesync/backups/locales'), {recursive: true})
    await writeFile(path.join(root, '.localesync/backups/locales/fr.json'), original, 'utf8')

    const summary = await resetLocales(root)

    expect(summary.files).toEqual(['locales/fr.json'])
    expect(await readFile(path.join(root, 'locales/fr.json'), 'utf8')).toBe(original)
    await expect(access(path.join(root, '.localesync'))).rejects.toMatchObject({code: 'ENOENT'})
    await expect(access(path.join(root, 'node_modules/.cache/localesync'))).rejects.toMatchObject({code: 'ENOENT'})
  })
})
