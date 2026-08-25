#!/usr/bin/env node

import {runStandaloneMain} from '../dist/standalone.js'

await runStandaloneMain(process.argv.slice(2))
