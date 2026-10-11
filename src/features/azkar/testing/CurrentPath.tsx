import { useLocation } from 'react-router-dom'

/** Exposes the router's path to tests as `data-testid="path"`. */
export function CurrentPath() {
  return <span data-testid="path">{useLocation().pathname}</span>
}
