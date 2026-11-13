'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Shell({ auth, title, tabs, children }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="sticky top-0 z-10 bg-emerald-800 text-white shadow">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <div className="text-lg font-bold">{title}</div>
            <div className="text-xs text-emerald-100">{auth.profile?.display_name}</div>
          </div>
          <button
            onClick={auth.signOut}
            className="rounded-lg bg-emerald-900 px-3 py-2 text-sm active:opacity-80"
          >
            ออกจากระบบ
          </button>
        </div>
        {tabs && (
          <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2 pb-2">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
                  pathname === t.href
                    ? 'bg-white font-semibold text-emerald-900'
                    : 'bg-emerald-700 text-white'
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4">{children}</main>
    </div>
  );
}
