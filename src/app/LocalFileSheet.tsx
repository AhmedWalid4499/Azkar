import { useEffect, useState } from 'react'
import { isNativeApp } from '../native'
import { Sheet } from '../shared/ui'

interface LocalFile {
  title: string
  text: string
  lang: string
}

/** What the link says on screen, without the words only screen readers get. */
function visibleText(link: HTMLAnchorElement): string {
  const copy = link.cloneNode(true) as HTMLAnchorElement
  for (const hidden of copy.querySelectorAll('.visually-hidden')) hidden.remove()
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * The app's own link to a file it ships with, opened in a new tab on the web:
 * the licence notices (licenses.txt). Links to other sites are not: in the app,
 * Capacitor hands those to the system browser.
 */
function localFileLink(event: MouseEvent): HTMLAnchorElement | null {
  if (event.defaultPrevented || event.button !== 0 || !(event.target instanceof Element)) return null
  const link = event.target.closest('a[href]')
  if (!(link instanceof HTMLAnchorElement) || link.target !== '_blank' || link.hasAttribute('download')) return null
  const url = new URL(link.href, window.location.href)
  return url.origin === window.location.origin && url.pathname !== window.location.pathname ? link : null
}

/**
 * In the app there is no new tab to open the app's own files in: iOS hands such
 * a link to the system, which cannot reach the app's private address, and
 * Android replaces the app with the file. They are shown here instead, in a
 * sheet over the page. On the web the link opens its tab as before.
 */
export function LocalFileSheet() {
  const [file, setFile] = useState<LocalFile | null>(null)

  useEffect(() => {
    if (!isNativeApp()) return
    let latest = 0
    const onClick = (event: MouseEvent) => {
      const link = localFileLink(event)
      if (!link) return
      event.preventDefault()
      const request = ++latest
      fetch(link.href)
        .then((response) => (response.ok ? response.text() : Promise.reject(new Error(String(response.status)))))
        .then((text) => {
          if (request === latest) setFile({ title: visibleText(link), text, lang: link.hreflang })
        })
        // Every build ships the file; only a development server may lack it.
        .catch(() => {})
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return (
    <Sheet open={file !== null} onClose={() => setFile(null)} title={file?.title ?? ''}>
      <pre className="app-file" lang={file?.lang || undefined} dir="auto">
        {file?.text}
      </pre>
    </Sheet>
  )
}
