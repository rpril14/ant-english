const KEY = 'showTranslation'

/** Returns stored translation visibility preference; defaults to true. */
export function getTranslationVisible(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'false'
  } catch {
    return true
  }
}

/** Persists translation visibility preference to localStorage. */
export function setTranslationVisible(visible: boolean): void {
  try {
    localStorage.setItem(KEY, String(visible))
  } catch {}
}
