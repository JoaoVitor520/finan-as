'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard', icon: '📊', label: 'Dashboard' },
  { href: '/transactions', icon: '💸', label: 'Transações' },
  { href: '/goals', icon: '🎯', label: 'Metas' },
  { href: '/insights', icon: '💡', label: 'Insights IA' },
  { href: '/couple', icon: '💑', label: 'Casal' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen bg-white border-r border-slate-100 p-4">
      <div className="px-3 py-4 mb-4">
        <span className="text-2xl font-bold text-indigo-600">Finan.as</span>
        <p className="text-xs text-slate-500 mt-1">Finanças do casal</p>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              pathname === item.href
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors w-full mt-4"
      >
        <span className="text-lg">🚪</span>
        Sair
      </button>
    </aside>
  )
}
