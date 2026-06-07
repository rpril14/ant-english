'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRef, useState } from 'react'
import type { SavedItem } from './page'

interface Props {
  initialItems: SavedItem[]
  apiBase: string
}

export function SavedClient({ initialItems, apiBase }: Props) {
  const [items, setItems] = useState<SavedItem[]>(initialItems)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  function showToast(msg: string) {
    clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }

  async function getToken() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }

  async function handleRemove(sentenceId: string) {
    const removed = items.find(i => i.sentenceId === sentenceId)
    if (!removed) return
    setItems(prev => prev.filter(i => i.sentenceId !== sentenceId))
    showToast('Sentence removed from saved list')
    try {
      const token = await getToken()
      await fetch(`${apiBase}/api/saved/${sentenceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      setItems(prev => [removed, ...prev])
      showToast('Could not remove — please try again')
    }
  }

  function startEditNote(item: SavedItem) {
    setEditingNote(item.sentenceId)
    setNoteText(item.note ?? '')
  }

  async function saveNote(sentenceId: string) {
    const token = await getToken()
    await fetch(`${apiBase}/api/saved/${sentenceId}/note`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ note: noteText.trim() || null }),
    })
    setItems(prev => prev.map(i =>
      i.sentenceId === sentenceId ? { ...i, note: noteText.trim() || null } : i
    ))
    setEditingNote(null)
    showToast('Note saved')
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Saved sentences</h1>
        <Link href="/library" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
          ← Library
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-center text-gray-500 py-16">
          No saved sentences yet — bookmark sentences during practice to see them here.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map(item => (
            <li key={item.sentenceId} className="rounded-xl border border-gray-700 bg-gray-800 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-base font-medium text-gray-100 leading-snug">{item.text}</p>
                <button
                  onClick={() => handleRemove(item.sentenceId)}
                  className="shrink-0 text-blue-400 hover:text-gray-400 transition-colors text-lg"
                  title="Remove from saved"
                  aria-label="Remove"
                >
                  🔖
                </button>
              </div>

              {item.translation && (
                <p className="text-sm text-gray-400 italic">{item.translation}</p>
              )}

              <p className="text-xs text-gray-500">
                From{' '}
                <Link href={`/practice/${item.videoId}`} className="text-blue-400 hover:underline">
                  {item.videoTitle}
                </Link>
              </p>

              {editingNote === item.sentenceId ? (
                <div className="space-y-2">
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    rows={2}
                    placeholder="Add a personal note…"
                    autoFocus
                    className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveNote(item.sentenceId)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                    >
                      Save note
                    </button>
                    <button
                      onClick={() => setEditingNote(null)}
                      className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => startEditNote(item)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {item.note ? `📝 ${item.note}` : '+ Add note'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm font-medium text-gray-100 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}
