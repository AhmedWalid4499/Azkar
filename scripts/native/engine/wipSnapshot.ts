// Loads files of the branch wip/web-seven-features (the reminder plan with its "not logged yet"
// deadlines, and the Qibla) without checking them out: `git show` writes them to a scratch
// directory with their imports pointed back at this checkout, and vitest runs them from there.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

export const WIP_BRANCH = 'wip/web-seven-features'

/** Run from the repository root (see vitest.config.ts). */
const repo = process.cwd()

/** Bare imports the snapshot files use, and where they live in this checkout. */
const PACKAGES: Record<string, string> = {
  adhan: join(repo, 'node_modules/adhan/lib/esm/Adhan.js'),
}

const snapshotRoot = () => process.env.WIP_SNAPSHOT_DIR ?? join(tmpdir(), 'azkar-engine-wip')

/**
 * Imports `path` as it is on the branch. `companions` are further files the branch has and this
 * checkout lacks (or has in another version): imports of them are pointed at their branch copy too.
 */
export async function importFromWip<T>(path: string, companions: readonly string[] = []): Promise<T> {
  const fromBranch = new Set([path, ...companions].map((file) => join(repo, file).replace(/\.tsx?$/, '')))
  const snapshotOf = (file: string) => join(snapshotRoot(), file)
  for (const file of [path, ...companions]) {
    const source = execFileSync('git', ['show', `${WIP_BRANCH}:${file}`], { cwd: repo, encoding: 'utf8' })
    const original = dirname(join(repo, file))
    const rewritten = source.replace(/from '([^']+)'/g, (_match, specifier: string) => {
      if (specifier.startsWith('.')) {
        const target = resolve(original, specifier)
        return fromBranch.has(target) ? `from '${snapshotOf(`${target.slice(repo.length + 1)}.ts`)}'` : `from '${target}'`
      }
      const target = PACKAGES[specifier]
      if (!target) throw new Error(`${file} imports ${specifier}, which the snapshot does not know`)
      return `from '${target}'`
    })
    mkdirSync(dirname(snapshotOf(file)), { recursive: true })
    writeFileSync(snapshotOf(file), rewritten)
  }
  return (await import(/* @vite-ignore */ snapshotOf(path))) as T
}
