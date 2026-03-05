'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Transaction, Goal, Profile, Couple } from '@/types'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function DashboardPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [couple, setCouple] = useState<Couple | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'individual' | 'joint'>('individual')

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [profileRes, coupleRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('couples').select('*').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).maybeSingle(),
    ])

    setProfile(profileRes.data)
    setCouple(coupleRes.data)

    const now = new Date()
    const sixMonthsAgo = subMonths(now, 5)

    let txQuery = supabase
      .from('transactions')
      .select('*, category:categories(*)')
      .gte('date', format(startOfMonth(sixMonthsAgo), 'yyyy-MM-dd'))
      .lte('date', format(endOfMonth(now), 'yyyy-MM-dd'))
      .order('date', { ascending: false })

    if (view === 'individual') {
      txQuery = txQuery.eq('user_id', user.id).eq('scope', 'individual')
    } else if (coupleRes.data) {
      txQuery = txQuery.eq('couple_id', coupleRes.data.id).eq('scope', 'joint')
    }

    const { data: txData } = await txQuery

    let goalsQuery = supabase.from('goals').select('*').eq('status', 'active')
    if (view === 'individual') {
      goalsQuery = goalsQuery.eq('user_id', user.id).eq('scope', 'individual')
    } else if (coupleRes.data) {
      goalsQuery = goalsQuery.eq('couple_id', coupleRes.data.id).eq('scope', 'joint')
    }

    const { data: goalsData } = await goalsQuery

    setTransactions(txData || [])
    setGoals(goalsData || [])
    setLoading(false)
  }, [supabase, view])

  useEffect(() => { loadData() }, [loadData])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const currentMonthTx = transactions.filter(t =>
    t.date >= format(startOfMonth(new Date()), 'yyyy-MM-dd')
  )

  const totalIncome = currentMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpenses = currentMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const balance = totalIncome - totalExpenses

  // Monthly chart data (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i)
    const start = format(startOfMonth(date), 'yyyy-MM-dd')
    const end = format(endOfMonth(date), 'yyyy-MM-dd')
    const monthTx = transactions.filter(t => t.date >= start && t.date <= end)
    return {
      name: format(date, 'MMM', { locale: ptBR }),
      Receitas: monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
      Despesas: monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
    }
  })

  // Categories pie data
  const categoryTotals = currentMonthTx
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      const key = t.category?.name || 'Outros'
      const color = t.category?.color || '#6b7280'
      acc[key] = { total: (acc[key]?.total || 0) + Number(t.amount), color }
      return acc
    }, {} as Record<string, { total: number; color: string }>)

  const pieData = Object.entries(categoryTotals)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6)
    .map(([name, data]) => ({ name, value: data.total, color: data.color }))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Olá, {profile?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-slate-500 mt-1">
            {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setView('individual')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              view === 'individual'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Individual
          </button>
          {couple?.user2_id && (
            <button
              onClick={() => setView('joint')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                view === 'joint'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              💑 Conjunto
            </button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-xl">💰</div>
            <span className="text-sm font-medium text-slate-500">Receitas</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
          <p className="text-xs text-slate-400 mt-1">Este mês</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl">💳</div>
            <span className="text-sm font-medium text-slate-500">Despesas</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
          <p className="text-xs text-slate-400 mt-1">Este mês</p>
        </div>

        <div className={`rounded-2xl p-5 border shadow-sm ${
          balance >= 0 ? 'bg-indigo-600 border-indigo-600' : 'bg-red-600 border-red-600'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
              {balance >= 0 ? '📈' : '📉'}
            </div>
            <span className="text-sm font-medium text-white/80">Saldo</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(balance)}</p>
          <p className="text-xs text-white/60 mt-1">Este mês</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Histórico (6 meses)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number | undefined) => formatCurrency(v ?? 0)} />
              <Bar dataKey="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Despesas" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Gastos por categoria</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number | undefined) => formatCurrency(v ?? 0)} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
              Sem despesas neste mês
            </div>
          )}
        </div>
      </div>

      {/* Goals + Recent transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active goals */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Metas ativas</h2>
            <Link href="/goals" className="text-sm text-indigo-600 hover:underline">Ver todas</Link>
          </div>
          {goals.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-slate-400 text-sm mb-3">Nenhuma meta cadastrada</p>
              <Link
                href="/goals"
                className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors"
              >
                Criar meta
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.slice(0, 3).map(goal => {
                const pct = Math.min((goal.current_amount / goal.target_amount) * 100, 100)
                return (
                  <div key={goal.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                        <span>{goal.icon}</span> {goal.title}
                      </span>
                      <span className="text-xs text-slate-500">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: goal.color }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-slate-500">{formatCurrency(goal.current_amount)}</span>
                      <span className="text-xs text-slate-500">{formatCurrency(goal.target_amount)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Últimas transações</h2>
            <Link href="/transactions" className="text-sm text-indigo-600 hover:underline">Ver todas</Link>
          </div>
          {currentMonthTx.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-slate-400 text-sm mb-3">Nenhuma transação este mês</p>
              <Link
                href="/transactions"
                className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors"
              >
                Adicionar transação
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {currentMonthTx.slice(0, 5).map(tx => (
                <div key={tx.id} className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: tx.category?.color ? `${tx.category.color}20` : '#f1f5f9' }}
                  >
                    {tx.category?.icon || '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{tx.description}</p>
                    <p className="text-xs text-slate-400">
                      {format(new Date(tx.date + 'T12:00:00'), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold flex-shrink-0 ${
                    tx.type === 'income' ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
