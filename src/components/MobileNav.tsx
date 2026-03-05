'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', icon: '📊', label: 'Início' },
  { href: '/transactions', icon: '💸', label: 'Transações' },
  { href: '/goals', icon: '🎯', label: 'Metas' },
  { href: '/insights', icon: '💡', label: 'Insights' },
  { href: '/couple', icon: '💑', label: 'Casal' },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-50">
      <div className="flex">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center py-2 px-1 text-xs font-medium transition-colors ${
              pathname === item.href
                ? 'text-indigo-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="text-xl mb-0.5">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
