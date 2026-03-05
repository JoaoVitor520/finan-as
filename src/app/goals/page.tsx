'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Goal, Couple } from '@/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

const ICONS = ['🎯', '🏠', '✈️', '🚗', '📱', '💻', '💍', '👶', '🎓', '🏖️', '💰', '🏥', '🛒', '🎉', '🐾']
const COLORS = ['#6366f1', '#f97316', '#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#14b8a6', '#ec4899', '#84cc16']

export default function GoalsPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<Goal[]>([])
  const [couple, setCouple] = useState<Couple | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showContribute, setShowContribute] = useState<Goal | null>(null)
  const [filterScope, setFilterScope] = useState<'all' | 'individual' | 'joint'>('all')
  const [userId, setUserId] = useState<string>('')

  const [form, setForm] = useState({
    title: '',
    description: '',
    target_amount: '',
    deadline: '',
    scope: 'individual' as 'individual' | 'joint',
    icon: '🎯',
    color: '#6366f1',
  })

  const [contribution, setContribution] = useState({ amount: '', notes: '' })

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const [coupleRes] = await Promise.all([
      supabase.from('couples').select('*').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).maybeSingle(),
    ])
    setCouple(coupleRes.data)

    const { data: goalsData } = await supabase
      .from('goals')
      .select('*')
      .or(coupleRes.data
        ? `user_id.eq.${user.id},couple_id.eq.${coupleRes.data.id}`
        : `user_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    setGoals(goalsData || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('goals').insert({
      user_id: user.id,
      couple_id: form.scope === 'joint' ? couple?.id : null,
      scope: form.scope,
      title: form.title,
      description: form.description || null,
      target_amount: parseFloat(form.target_amount),
      deadline: form.deadline || null,
      icon: form.icon,
      color: form.color,
    })

    if (!error) {
      setShowForm(false)
      setForm({ title: '', description: '', target_amount: '', deadline: '', scope: 'individual', icon: '🎯', color: '#6366f1' })
      loadData()
    }
  }

  async function handleContribute(e: React.FormEvent) {
    e.preventDefault()
    if (!showContribute) return

    const { error } = await supabase.from('goal_contributions').insert({
      goal_id: showContribute.id,
      user_id: userId,
      amount: parseFloat(contribution.amount),
      notes: contribution.notes || null,
    })

    if (!error) {
      setShowContribute(null)
      setContribution({ amount: '', notes: '' })
      loadData()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deletar esta meta?')) return
    await supabase.from('goals').delete().eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  async function handleCancel(id: string) {
    await supabase.from('goals').update({ status: 'cancelled' }).eq('id', id)
    loadData()
  }

  const filtered = goals.filter(g => {
    if (filterScope !== 'all' && g.scope !== filterScope) return false
    return true
  })

  const active = filtered.filter(g => g.status === 'active')
  const completed = filtered.filter(g => g.status === 'completed')
  const cancelled = filtered.filter(g => g.status === 'cancelled')

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Metas</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <span>+</span> Nova meta
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'individual', 'joint'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterScope(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filterScope === f
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f === 'all' ? 'Todas' : f === 'individual' ? 'Individuais' : '💑 Conjuntas'}
          </button>
        ))}
      </div>

      {/* Active goals */}
      {active.length > 0 && (
        <div className="mb-8">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Ativas ({active.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {active.map(goal => {
              const pct = Math.min((goal.current_amount / goal.target_amount) * 100, 100)
              const remaining = goal.target_amount - goal.current_amount
              return (
                <div key={goal.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                        style={{ backgroundColor: `${goal.color}20` }}
                      >
                        {goal.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{goal.title}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          {goal.scope === 'joint' && <span className="text-xs bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full">💑 Conjunto</span>}
                          {goal.deadline && (
                            <span className="text-xs text-slate-400">
                              até {format(new Date(goal.deadline + 'T12:00:00'), 'MMM/yyyy', { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {goal.user_id === userId && (
                        <button
                          onClick={() => handleDelete(goal.id)}
                          className="text-slate-300 hover:text-red-400 text-lg transition-colors p-1"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {goal.description && (
                    <p className="text-sm text-slate-500 mb-3">{goal.description}</p>
                  )}

                  <div className="mb-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-800">{formatCurrency(goal.current_amount)}</span>
                      <span className="text-sm text-slate-500">{formatCurrency(goal.target_amount)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3">
                      <div
                        className="h-3 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: goal.color }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-xs text-slate-500">{pct.toFixed(1)}% concluído</span>
                      <span className="text-xs text-slate-500">Falta {formatCurrency(remaining)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowContribute(goal)}
                    className="w-full py-2 rounded-xl text-sm font-medium transition-colors text-white"
                    style={{ backgroundColor: goal.color }}
                  >
                    + Depositar
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {active.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 mb-8">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-slate-500 mb-4">Nenhuma meta ativa. Crie sua primeira meta!</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            Criar meta
          </button>
        </div>
      )}

      {/* Completed goals */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-700 mb-4">Concluídas ({completed.length})</h2>
          <div className="space-y-3">
            {completed.map(goal => (
              <div key={goal.id} className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center gap-4">
                <span className="text-2xl">{goal.icon}</span>
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{goal.title}</p>
                  <p className="text-sm text-green-600">Meta alcançada! {formatCurrency(goal.target_amount)}</p>
                </div>
                <span className="text-2xl">🎉</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create goal modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900">Nova meta</h2>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                        {s === 'individual' ? 'Individual' : '💑 Conjunta'}
                      </button>
                    ))}
                  </div>
                )}

                {/* Icon picker */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Ícone</label>
                  <div className="flex flex-wrap gap-2">
                    {ICONS.map(icon => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, icon }))}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                          form.icon === icon ? 'bg-indigo-100 ring-2 ring-indigo-500 scale-110' : 'bg-slate-100 hover:bg-slate-200'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color picker */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Cor</label>
                  <div className="flex gap-2">
                    {COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, color }))}
                        className={`w-8 h-8 rounded-full transition-all ${
                          form.color === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Título da meta</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                    required
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: Viagem para Europa"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Descrição (opcional)</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    placeholder="Descreva sua meta..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Valor alvo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={form.target_amount}
                    onChange={e => setForm(prev => ({ ...prev, target_amount: e.target.value }))}
                    required
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-semibold"
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Prazo (opcional)</label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={e => setForm(prev => ({ ...prev, deadline: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    Criar meta
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Contribute modal */}
      {showContribute && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">Depositar na meta</h2>
                <button onClick={() => setShowContribute(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl mb-5" style={{ backgroundColor: `${showContribute.color}15` }}>
                <span className="text-2xl">{showContribute.icon}</span>
                <div>
                  <p className="font-medium text-slate-800">{showContribute.title}</p>
                  <p className="text-sm text-slate-500">
                    {formatCurrency(showContribute.current_amount)} / {formatCurrency(showContribute.target_amount)}
                  </p>
                </div>
              </div>

              <form onSubmit={handleContribute} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={contribution.amount}
                    onChange={e => setContribution(prev => ({ ...prev, amount: e.target.value }))}
                    required
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-semibold"
                    placeholder="0,00"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Observação (opcional)</label>
                  <input
                    type="text"
                    value={contribution.notes}
                    onChange={e => setContribution(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: Salário de fevereiro"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowContribute(null)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl text-white font-medium transition-colors"
                    style={{ backgroundColor: showContribute.color }}
                  >
                    Depositar
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
