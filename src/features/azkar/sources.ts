import { sourceUsedForAr } from './strings'

/** Host and path of a web address, without the trailing slash; `null` for anything else. */
function addressOf(url: unknown): string | null {
  if (typeof url !== 'string') return null
  try {
    const { hostname, pathname } = new URL(url)
    return `${hostname}${pathname}`.replace(/\/+$/, '')
  } catch {
    return null
  }
}

/**
 * The Arabic wording of what a dataset source was used for, found by the source's address:
 * its site, or its repository whatever revision the link is pinned to. `undefined` when
 * there is none, in which case the dataset's own English is shown.
 */
export function arabicUsedFor(url: unknown): string | undefined {
  const address = addressOf(url)
  if (address === null) return undefined
  const key = Object.keys(sourceUsedForAr).find((known) => address === known || address.startsWith(`${known}/`))
  return key === undefined ? undefined : sourceUsedForAr[key]
}
