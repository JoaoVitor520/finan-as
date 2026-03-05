'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Transaction, Category, Couple } from '@/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

const ICONS = ['🎯', '🚗', '🏠', '🍽️', '💊', '📚', '✈️', '🎉', '💼', '💻', '💰', '📦']
const COLORS = ['#6366f1', '#f97316', '#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#14b8a6', '#ec4899', '#84cc16', '#0ea5e9', '#6b7280']

export default function TransactionsPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [couple, setCouple] = useState<Couple | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [scopeFilter, setScopeFilter] = useState<'all' | 'individual' | 'joint'>('all')
  const [aiLoading, setAiLoading] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    type: 'expense' as 'income' | 'expense',
    scope: 'individual' as 'individual' | 'joint',
    amount: '',
    description: '',
    notes: '',
    category_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    receipt_url: '',
    ai_description: '',
    ai_analyzed: false,
  })

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const [coupleRes, catRes] = await Promise.all([
      supabase.from('couples').select('*').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).maybeSingle(),
      supabase.from('categories').select('*').or('is_default.eq.true'),
    ])

    setCouple(coupleRes.data)
    setCategories(catRes.data || [])

    const { data: txData } = await supabase
      .from('transactions')
      .select('*, category:categories(*)')
      .or(coupleRes.data
        ? `user_id.eq.${user.id},couple_id.eq.${coupleRes.data.id}`
        : `user_id.eq.${user.id}`)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)

    setTransactions(txData || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setAiLoading(true)
    try {
      // Upload to Supabase storage
      const fileName = `${userId}/${Date.now()}-${file.name}`
      const { data: uploadData } = await supabase.storage
        .from('receipts')
        .upload(fileName, file)

      if (uploadData) {
        const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName)

        // Convert to base64 for Gemini
        const reader = new FileReader()
        reader.onload = async (ev) => {
          const base64 = (ev.target?.result as string).split(',')[1]
          const mimeType = file.type

          const res = await fetch('/api/analyze-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64, mimeType }),
          })

          if (res.ok) {
            const data = await res.json()
            setForm(prev => ({
              ...prev,
              description: data.description || prev.description,
              amount: data.amount ? String(data.amount) : prev.amount,
              date: data.date || prev.date,
              type: data.type || prev.type,
              ai_description: data.description,
              ai_analyzed: true,
              receipt_url: publicUrl,
              category_id: categories.find(c =>
                c.name.toLowerCase() === data.category?.toLowerCase() && c.type !== 'income'
              )?.id || prev.category_id,
            }))
          }
          setAiLoading(false)
        }
        reader.readAsDataURL(file)
      }
    } catch {
      setAiLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      couple_id: form.scope === 'joint' ? couple?.id : null,
      category_id: form.category_id || null,
      type: form.type,
      scope: form.scope,
      amount: parseFloat(form.amount),
      description: form.description,
      notes: form.notes || null,
      date: form.date,
      receipt_url: form.receipt_url || null,
      ai_analyzed: form.ai_analyzed,
      ai_description: form.ai_description || null,
    })

    if (!error) {
      setShowForm(false)
      setForm({
        type: 'expense', scope: 'individual', amount: '', description: '',
        notes: '', category_id: '', date: format(new Date(), 'yyyy-MM-dd'),
        receipt_url: '', ai_description: '', ai_analyzed: false,
      })
      loadData()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deletar esta transação?')) return
    await supabase.from('transactions').delete().eq('id', id)
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  const filtered = transactions.filter(t => {
    if (filter !== 'all' && t.type !== filter) return false
    if (scopeFilter !== 'all' && t.scope !== scopeFilter) return false
    return true
  })

  const currentCategories = categories.filter(c =>
    c.type === form.type || c.type === 'both'
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Transações</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <span>+</span> Nova
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['all', 'income', 'expense'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f === 'all' ? 'Todos' : f === 'income' ? 'Receitas' : 'Despesas'}
          </button>
        ))}
        <div className="h-6 w-px bg-slate-200 self-center mx-1" />
        {(['all', 'individual', 'joint'] as const).map(f => (
          <button
            key={f}
            onClick={() => setScopeFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              scopeFilter === f
                ? 'bg-purple-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f === 'all' ? 'Todos' : f === 'individual' ? 'Individual' : 'Conjunto'}
          </button>
        ))}
      </div>

      {/* Transaction list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <p className="text-slate-400 text-lg mb-2">Nenhuma transação encontrada</p>
            <p className="text-slate-400 text-sm">Clique em &quot;Nova&quot; para adicionar</p>
          </div>
        ) : (
          filtered.map(tx => (
            <div key={tx.id} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: tx.category?.color ? `${tx.category.color}20` : '#f1f5f9' }}
              >
                {tx.category?.icon || (tx.type === 'income' ? '💰' : '📦')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800 truncate">{tx.description}</p>
                  {tx.ai_analyzed && (
                    <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full flex-shrink-0">IA</span>
                  )}
                  {tx.scope === 'joint' && (
                    <span className="text-xs bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full flex-shrink-0">💑</span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {tx.category?.name || 'Sem categoria'} · {format(new Date(tx.date + 'T12:00:00'), 'dd/MM/yyyy')}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-sm font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                </span>
                {tx.user_id === userId && (
                  <button
                    onClick={() => handleDelete(tx.id)}
                    className="text-slate-300 hover:text-red-400 transition-colors text-lg"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900">Nova transação</h2>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
              </div>

              {/* Receipt upload */}
              <div className="mb-6">
                <p className="text-sm font-medium text-slate-700 mb-2">Analisar comprovante com IA</p>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={aiLoading}
                  className="w-full border-2 border-dashed border-indigo-200 rounded-xl p-4 text-center hover:border-indigo-400 transition-colors text-sm text-slate-600 disabled:opacity-50"
                >
                  {aiLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600" />
                      Analisando com Gemini...
                    </span>
                  ) : (
                    <span>📸 Fotografar ou enviar comprovante (IA preenche automaticamente)</span>
                  )}
                </button>
                {form.ai_analyzed && (
                  <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                    ✨ Preenchido pela IA · Verifique os dados antes de salvar
                  </p>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Type */}
                <div className="flex gap-2">
                  {(['expense', 'income'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, type: t, category_id: '' }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        form.type === t
                          ? t === 'expense' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {t === 'expense' ? '📉 Despesa' : '📈 Receita'}
                    </button>
                  ))}
                </div>

                {/* Scope */}
                {couple?.user2_id && (
                  <div className="flex gap-2">
                    {(['individual', 'joint'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, scope: s }))}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          form.scope === s
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {s === 'individual' ? 'Individual' : '💑 Conjunto'}
                      </button>
                    ))}
                  </div>
                )}

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.amount}
                    onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
                    required
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-semibold"
                    placeholder="0,00"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Descrição</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                    required
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: Almoço no restaurante"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Categoria</label>
                  <select
                    value={form.category_id}
                    onChange={e => setForm(prev => ({ ...prev, category_id: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecionar categoria</option>
                    {currentCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Data</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                    required
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Observações (opcional)</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    placeholder="Adicionar observações..."
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
