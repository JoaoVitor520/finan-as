'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Couple, Profile } from '@/types'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function MarkdownContent({ content }: { content: string }) {
  const html = content
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[^]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')

  return <div className="prose text-slate-700 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
}

export default function InsightsPage() {
  const supabase = createClient()
  const [couple, setCouple] = useState<Couple | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [scope, setScope] = useState<'individual' | 'joint'>('individual')
  const [period, setPeriod] = useState<'current' | 'last3' | 'last6'>('current')
  const [insight, setInsight] = useState<string>('')
  const [error, setError] = useState<string>('')

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [profileRes, coupleRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('couples').select('*').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).maybeSingle(),
    ])

    setProfile(profileRes.data)
    setCouple(coupleRes.data)

    if (coupleRes.data?.user2_id) {
      const partnerId = coupleRes.data.user1_id === user.id
        ? coupleRes.data.user2_id
        : coupleRes.data.user1_id
      const { data: partnerData } = await supabase.from('profiles').select('*').eq('id', partnerId).single()
      setPartnerProfile(partnerData)
    }
    setInitialLoading(false)
  }, [supabase])

  useEffect(() => { loadProfile() }, [loadProfile])

  async function generateInsights() {
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const now = new Date()
    let startDate: string
    let endDate = format(endOfMonth(now), 'yyyy-MM-dd')

    if (period === 'current') {
      startDate = format(startOfMonth(now), 'yyyy-MM-dd')
    } else if (period === 'last3') {
      startDate = format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd')
    } else {
      startDate = format(startOfMonth(subMonths(now, 5)), 'yyyy-MM-dd')
    }

    let txQuery = supabase
      .from('transactions')
      .select('*, category:categories(name)')
      .gte('date', startDate)
      .lte('date', endDate)

    if (scope === 'individual') {
      txQuery = txQuery.eq('user_id', user.id).eq('scope', 'individual')
    } else if (couple) {
      txQuery = txQuery.eq('couple_id', couple.id).eq('scope', 'joint')
    }

    let goalsQuery = supabase.from('goals').select('*').eq('status', 'active')
    if (scope === 'individual') {
      goalsQuery = goalsQuery.eq('user_id', user.id).eq('scope', 'individual')
    } else if (couple) {
      goalsQuery = goalsQuery.eq('couple_id', couple.id).eq('scope', 'joint')
    }

    const [{ data: txData }, { data: goalsData }] = await Promise.all([txQuery, goalsQuery])

    const transactions = (txData || []).map(t => ({
      type: t.type,
      amount: t.amount,
      description: t.description,
      category: (t.category as { name: string } | null)?.name,
      date: t.date,
      scope: t.scope,
    }))

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

    try {
      const res = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions,
          goals: goalsData || [],
          totalIncome,
          totalExpenses,
          scope,
          partnerName: partnerProfile?.name,
        }),
      })

      if (!res.ok) throw new Error('Erro na API')

      const data = await res.json()
      setInsight(data.insight)

      // Save insight to DB
      await supabase.from('ai_insights').insert({
        user_id: user.id,
        couple_id: scope === 'joint' ? couple?.id : null,
        scope,
        content: data.insight,
        period_start: startDate,
        period_end: endDate,
      })
    } catch {
      setError('Erro ao gerar insights. Verifique a chave da API Gemini no arquivo .env.local')
    }

    setLoading(false)
  }

  const periodLabels = {
    current: 'Mês atual',
    last3: 'Últimos 3 meses',
    last6: 'Últimos 6 meses',
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Insights com IA</h1>
        <p className="text-slate-500">Análise inteligente das suas finanças com Google Gemini</p>
      </div>

      {/* Config card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm mb-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Configurar análise</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Visão</label>
            <div className="flex gap-2">
              <button
                onClick={() => setScope('individual')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  scope === 'individual'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Individual
              </button>
              {couple?.user2_id && (
                <button
                  onClick={() => setScope('joint')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    scope === 'joint'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  💑 Conjunto
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Período</label>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value as typeof period)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            >
              <option value="current">Mês atual</option>
              <option value="last3">Últimos 3 meses</option>
              <option value="last6">Últimos 6 meses</option>
            </select>
          </div>
        </div>

        <button
          onClick={generateInsights}
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Analisando com Gemini...
            </>
          ) : (
            <>
              ✨ Gerar insights com IA
            </>
          )}
        </button>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Insight result */}
      {insight && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-lg">✨</span>
              </div>
              <div>
                <p className="text-white font-semibold">Análise Gemini AI</p>
                <p className="text-white/70 text-xs">
                  {scope === 'individual' ? 'Individual' : 'Conjunto'} · {periodLabels[period]} ·{' '}
                  {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
                </p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <MarkdownContent content={insight} />
          </div>
        </div>
      )}

      {/* Tips */}
      {!insight && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: '📊', title: 'Padrões de gastos', desc: 'Identifique onde você gasta mais e descubra oportunidades de economia' },
            { icon: '🎯', title: 'Análise de metas', desc: 'Saiba se está no caminho certo para alcançar seus objetivos financeiros' },
            { icon: '💡', title: 'Dicas práticas', desc: 'Receba recomendações personalizadas para melhorar sua saúde financeira' },
          ].map(tip => (
            <div key={tip.title} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-center">
              <div className="text-3xl mb-3">{tip.icon}</div>
              <h3 className="font-semibold text-slate-900 mb-1 text-sm">{tip.title}</h3>
              <p className="text-slate-500 text-xs">{tip.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
