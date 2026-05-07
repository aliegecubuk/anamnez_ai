'use client'

import { useState } from 'react'

export function UpdateRoleForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setIsLoading(true)
    setMessage(null)

    const formData = new FormData(form)
    const userId = String(formData.get('userId') ?? '').trim()
    const role = String(formData.get('role') ?? '').trim()

    if (!userId || !role) {
      setMessage({ type: 'error', text: 'userId ve rol zorunlu.' })
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/superadmin/users/${encodeURIComponent(userId)}/role`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ type: 'error', text: data?.error ?? `Hata: ${res.status}` })
        return
      }
      setMessage({ type: 'success', text: 'Rol güncellendi.' })
      form.reset()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Bilinmeyen hata' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input
        name="userId"
        required
        placeholder="Clerk user_id (user_...)"
        className="border rounded px-3 py-2 text-sm sm:col-span-2"
        disabled={isLoading}
      />
      <select
        name="role"
        required
        defaultValue=""
        className="border rounded px-3 py-2 text-sm sm:col-span-2"
        disabled={isLoading}
      >
        <option value="" disabled>Rol seçin</option>
        <option value="superadmin">Süpervizör (superadmin)</option>
        <option value="user">Standart kullanıcı (rol kaldır)</option>
      </select>

      {message && (
        <p
          className={`sm:col-span-2 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-destructive'}`}
          role="alert"
          aria-live="polite"
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="sm:col-span-2 bg-secondary text-secondary-foreground rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {isLoading ? 'Güncelleniyor...' : 'Rolü Güncelle'}
      </button>
    </form>
  )
}
