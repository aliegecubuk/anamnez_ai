// Registers evals/alias-loader.mjs as a module customization hook.
// Loaded via: node --import ./evals/register-alias.mjs ...
import { register } from 'node:module'

register('./alias-loader.mjs', import.meta.url)
