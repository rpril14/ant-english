export type SidebarItemState = 'completed' | 'current' | 'unseen'

export interface SidebarItem {
  id: string
  index: number
  text: string
  state: SidebarItemState
}

/**
 * Derives the display state of each sentence for the transcript sidebar.
 * Completed takes precedence over current (revisiting a finished sentence).
 */
export function deriveSidebar(
  sentences: Array<{ id: string; index: number; text: string }>,
  currentId: string,
  progress: Record<string, { completed_at: string | null }>,
): SidebarItem[] {
  return sentences.map(s => ({
    id: s.id,
    index: s.index,
    text: s.text,
    state: progress[s.id]?.completed_at
      ? 'completed'
      : s.id === currentId
        ? 'current'
        : 'unseen',
  }))
}
