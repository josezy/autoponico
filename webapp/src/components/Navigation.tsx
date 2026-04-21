"use client"

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TbHome, TbCamera, TbTerminal } from 'react-icons/tb';

export default function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Dashboard', icon: TbHome },
    { href: '/cameras', label: 'Cameras', icon: TbCamera },
    { href: '/cli', label: 'CLI', icon: TbTerminal },
  ];

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍃</span>
            <span className="font-bold text-xl text-gray-900 dark:text-white">
              Autoponico
            </span>
          </div>
          <div className="flex gap-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
                    ${isActive
                      ? 'bg-teal-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <Icon size={20} />
                  <span className="hidden sm:inline">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
