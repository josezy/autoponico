'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Dashboard', match: (path: string) => path === '/' },
  { href: '/itineraries', label: 'Itineraries', match: (path: string) => path.startsWith('/itineraries') },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <Link href="/" className="font-bold text-gray-900">Autoponico</Link>
        <nav className="flex gap-1">
          {links.map((link) => {
            const active = link.match(pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-md text-sm font-medium min-h-[44px] inline-flex items-center ${active ? 'bg-teal-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
