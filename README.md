# LocaleSync

Keep Shopify theme locale files structurally in sync without overwriting translations for matching keys.

LocaleSync adds missing keys, removes obsolete non-plural keys and handles storefront and theme-editor schema locales separately.

## Install

LocaleSync requires Node.js 22.12 or later.

Install LocaleSync once as a Shopify CLI 4 plugin. The commands will then be available from any Shopify theme:

```bash
shopify plugins install @conducivemammal/shopify-locale-sync
```

Shopify CLI manages the plugin installation at the user level, so it does not need to be added to each theme's dependencies.

## Usage

Check a theme before changing any files:

```bash
shopify theme locales check
```

> [!IMPORTANT]
> A sync adds missing keys and removes obsolete non-plural keys. Preview the result before the first write.

```bash
shopify theme locales sync --dry-run
shopify theme locales sync
```

Restore every changed locale file to its state before the first sync:

```bash
shopify theme locales reset
```

Pass additional options directly to the Shopify CLI command:

```bash
# Fail CI when differences are found
shopify theme locales check --fail-on-differences

# Use another theme and return JSON
shopify theme locales check --path ./themes/example --json

# Export the report
shopify theme locales check --export ./reports/locales-check.log
```

Append `--help` to a command for its complete reference, for example `shopify theme locales check --help`.

## Behaviour

LocaleSync uses each `*.default.json` and `*.default.schema.json` file as its source of truth. It:

- Adds keys missing from target locales
- Removes non-plural target keys missing from the default locale
- Preserves translations for matching keys and locale-specific plural categories
- Preserves comments, trailing commas, indentation and line endings
- Reports structural conflicts instead of replacing incompatible values

The first sync stores a restorable baseline under `node_modules/.cache/localesync/backups/`. Checks and dry runs never create backups.

## Exit codes

- `0`: the command completed; `check` also uses this when it finds differences
- `1`: `check --fail-on-differences` found differences
- `2`: LocaleSync found a structural conflict or could not complete the command

## Development

```bash
npm ci
npm run verify
```

## License

MIT
