import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { exitNativeApp, onNativeBackButton } from '../native'

/** The dialog on top, if one is open. */
function topDialog(): HTMLDialogElement | undefined {
  const open = document.querySelectorAll<HTMLDialogElement>('dialog[open]')
  return open[open.length - 1]
}

/** As the Escape key does: a `cancel` the dialog may turn down, then close. */
function dismiss(dialog: HTMLDialogElement) {
  if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close()
}

/**
 * Android's back button and back gesture: close the sheet that is open, else
 * go back to the previous screen, and leave the app from the Today screen.
 * A screen opened directly (from a reminder, say) goes back to Today. Does
 * nothing on iOS or in a browser.
 */
export function useNativeBackButton(): void {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // Read when the button is pressed, so the listener is added once rather than on every navigation.
  const latest = useRef({ navigate, pathname })

  useEffect(() => {
    latest.current = { navigate, pathname }
  })

  useEffect(
    () =>
      onNativeBackButton(({ canGoBack }) => {
        const { navigate, pathname } = latest.current
        const dialog = topDialog()
        if (dialog) dismiss(dialog)
        else if (pathname === '/') exitNativeApp()
        else if (canGoBack) navigate(-1)
        else navigate('/', { replace: true })
      }),
    [],
  )
}
