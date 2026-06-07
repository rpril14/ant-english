/** Derives the next saved-id set after a toggle. Pure — no side effects. */
export function toggleSavedId(current: Set<string>, sentenceId: string): Set<string> {
  const next = new Set(current)
  if (next.has(sentenceId)) next.delete(sentenceId)
  else next.add(sentenceId)
  return next
}
