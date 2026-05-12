import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

import { ToastContainer } from 'react-toastify';

import 'react-toastify/dist/ReactToastify.css';
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Autoponico Dashboard',
  description: 'Panel de control para autoponico',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {children}
        </main>
        <ToastContainer />
      </body>
    </html>
  )
}
