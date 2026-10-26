import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { isNativeApp } from './platform'

function download(name: string, text: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * Hands a text file to the user: a download in a browser, the system share
 * sheet in the app (Save to Files, Drive, mail and so on). Resolves to false
 * when the user closed the share sheet without choosing anything.
 */
export async function saveTextFile(name: string, text: string, mimeType: string): Promise<boolean> {
  if (!isNativeApp()) {
    download(name, text, mimeType)
    return true
  }
  const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 })
  try {
    await Share.share({ title: name, files: [uri] })
    return true
  } catch (error) {
    if (error instanceof Error && /cancel/i.test(error.message)) return false
    throw error
  }
}
