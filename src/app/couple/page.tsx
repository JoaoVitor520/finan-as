'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Couple, Profile } from '@/types'

export default function CouplePage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [couple, setCouple] = useState<Couple | null>(null)
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteCode, setInviteCode] = useState('')
  const [coupleNameInput, setCoupleNameInput] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [copiedCode, setCopiedCode] = useState(false)
  const [userId, setUserId] = useState<string>('')

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

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

    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  async function createCouple() {
    setError('')
    const name = coupleNameInput.trim() || 'Nosso Casal'
    const { data, error } = await supabase.from('couples').insert({
      user1_id: userId,
      name,
    }).select().single()

    if (error) {
      setError('Erro ao criar vínculo.')
    } else {
      setCouple(data)
      setSuccess('Vínculo criado! Compartilhe o código com sua parceira(o).')
    }
  }

  async function joinCouple() {
    setError('')
    if (!joinCode.trim()) return

    const { data: coupleData } = await supabase
      .from('couples')
      .select('*')
      .eq('invite_code', joinCode.trim().toUpperCase())
      .is('user2_id', null)
      .single()

    if (!coupleData) {
      setError('Código inválido ou já utilizado.')
      return
    }

    if (coupleData.user1_id === userId) {
      setError('Você não pode se vincular a si mesmo.')
      return
    }

    const { error } = await supabase
      .from('couples')
      .update({ user2_id: userId })
      .eq('id', coupleData.id)

    if (error) {
      setError('Erro ao entrar no casal.')
    } else {
      setSuccess('Vinculado com sucesso!')
      loadData()
    }
  }

  async function copyInviteCode() {
    if (!couple) return
    await navigator.clipboard.writeText(couple.invite_code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  async function leaveCouple() {
    if (!couple) return
    if (!confirm('Deseja realmente desvincular do casal? Isso não apaga os dados.')) return

    if (couple.user1_id === userId) {
      await supabase.from('couples').update({ user2_id: null }).eq('id', couple.id)
    } else {
      await supabase.from('couples').update({ user2_id: null }).eq('id', couple.id)
    }

    setCouple(null)
    setPartnerProfile(null)
    setSuccess('Desvinculado do casal.')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Meu Casal</h1>
        <p className="text-slate-500">Gerencie o vínculo com sua parceira(o)</p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-4 text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
          {error}
        </div>
      )}

      {/* My profile */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-5">
        <h2 className="text-sm font-medium text-slate-500 mb-3">Meu perfil</h2>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-xl font-bold text-indigo-600">
            {profile?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{profile?.name}</p>
            <p className="text-xs text-slate-500">Você</p>
          </div>
        </div>
      </div>

      {/* Couple status */}
      {couple ? (
        <div className="space-y-4">
          {/* Couple card */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-5 border border-indigo-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">{couple.name}</h2>
              <span className="text-2xl">💑</span>
            </div>

            {couple.user2_id && partnerProfile ? (
              <div className="flex items-center gap-3 mb-4">
                <div className="flex -space-x-2">
                  <div className="w-10 h-10 rounded-full bg-indigo-200 border-2 border-white flex items-center justify-center text-lg font-bold text-indigo-700">
                    {profile?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-purple-200 border-2 border-white flex items-center justify-center text-lg font-bold text-purple-700">
                    {partnerProfile.name?.[0]?.toUpperCase() || '?'}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {profile?.name} & {partnerProfile.name}
                  </p>
                  <p className="text-xs text-green-600">Vinculados</p>
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-3">Aguardando sua parceira(o) entrar com o código:</p>
                <div className="flex items-center gap-3">
                  <div className="bg-white border border-indigo-200 rounded-xl px-5 py-3 font-mono text-2xl font-bold text-indigo-600 tracking-widest">
                    {couple.invite_code}
                  </div>
                  <button
                    onClick={copyInviteCode}
                    className="bg-indigo-600 text-white px-4 py-3 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    {copiedCode ? '✓ Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}

            {couple.user2_id && (
              <button
                onClick={leaveCouple}
                className="text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                Desvincular do casal
              </button>
            )}
          </div>

          {/* Tips */}
          {couple.user2_id && (
            <div className="bg-white rounded-2xl p-5 border border-slate-100">
              <h3 className="font-semibold text-slate-900 mb-3">O que vocês podem fazer juntos</h3>
              <ul className="space-y-2">
                {[
                  'Registrar transações conjuntas (divididas pelo casal)',
                  'Criar metas financeiras do casal',
                  'Ver o dashboard conjunto com todos os gastos',
                  'Receber insights de IA para as finanças do casal',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-indigo-500 mt-0.5">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Create couple */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Criar vínculo</h2>
            <p className="text-sm text-slate-500 mb-4">Gere um código para compartilhar com sua parceira(o)</p>
            <div className="flex gap-3">
              <input
                type="text"
                value={coupleNameInput}
                onChange={e => setCoupleNameInput(e.target.value)}
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder='Nome do casal (ex: "João & Maria")'
              />
              <button
                onClick={createCouple}
                className="bg-indigo-600 text-white px-5 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors text-sm whitespace-nowrap"
              >
                Criar
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">ou</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Join couple */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Entrar com código</h2>
            <p className="text-sm text-slate-500 mb-4">Use o código gerado pela sua parceira(o)</p>
            <div className="flex gap-3">
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-lg tracking-widest uppercase"
                placeholder="XXXXXXXX"
                maxLength={8}
              />
              <button
                onClick={joinCouple}
                className="bg-purple-600 text-white px-5 py-3 rounded-xl font-medium hover:bg-purple-700 transition-colors text-sm"
              >
                Entrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
