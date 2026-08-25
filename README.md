# LocaleSync

Keep Shopify theme locale files structurally in sync without overwriting translations for matching keys.

LocaleSync adds missing keys, removes obsolete non-plural keys and handles storefront and theme-editor schema locales separately.

## Install

LocaleSync requires Node.js 22.12 or later.

Install it in your Shopify theme:

```bash
npm install --save-dev @conducivemammal/shopify-locale-sync
```

Add these scripts to the theme's `package.json`:

```json
{
  "scripts": {
    "locales:check": "localesync check",
    "locales:sync": "localesync sync",
    "locales:reset": "localesync reset"
  }
}
```

Alternatively, install LocaleSync as a Shopify CLI 4 plugin:

```bash
shopify plugins install @conducivemammal/shopify-locale-sync
```

Installing the npm dependency does not register the Shopify CLI commands. Choose the installation method that matches how you want to run LocaleSync.

## Usage

Check a theme before changing any files:

```bash
npm run locales:check
```

> [!IMPORTANT]
> A sync adds missing keys and removes obsolete non-plural keys. Preview the result before the first write.

```bash
npm run locales:sync -- --dry-run
npm run locales:sync
```

Restore every changed locale file to its state before the first sync:

```bash
npm run locales:reset
```

Pass additional options after `--`:

```bash
# Fail CI when differences are found
npm run locales:check -- --fail-on-differences

# Use another theme and return JSON
npm run locales:check -- --path ./themes/example --json

# Export the report
npm run locales:check -- --export ./reports/locales-check.log
```

The equivalent Shopify CLI commands are:

```bash
shopify theme locales check
shopify theme locales sync --dry-run
shopify theme locales sync
shopify theme locales reset
```

Run `npm exec -- localesync --help` for the complete command reference.

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
