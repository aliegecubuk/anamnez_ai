// Module resolution hooks for the eval harness under Node's native TypeScript
// execution (--experimental-strip-types):
//  1. '@/' -> tsconfig path alias (tsconfig.json -> paths: {"@/*": ["./src/*"]}),
//     which Node does not read.
//  2. Relative './x.js' specifiers -> sibling './x.ts' when only the .ts file
//     exists (TS "bundler"-style imports used inside evals/).
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SRC_DIR = path.resolve(process.cwd(), 'src')
const EXTENSIONS = ['.ts', '.tsx', '.js', '.mts']

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const base = path.join(SRC_DIR, specifier.slice(2))
    for (const ext of EXTENSIONS) {
      const file = base + ext
      if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true }
    }
    for (const ext of EXTENSIONS) {
      const file = path.join(base, `index${ext}`)
      if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true }
    }
  }
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    specifier.endsWith('.js') &&
    context.parentURL?.startsWith('file:')
  ) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL))
    const tsFile = path.resolve(parentDir, specifier.replace(/\.js$/, '.ts'))
    if (existsSync(tsFile)) return { url: pathToFileURL(tsFile).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
