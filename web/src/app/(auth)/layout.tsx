import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex flex-col">
      {/* Simple Header */}
      <header className="p-4">
        <Link href="/" className="flex items-center space-x-2 text-white">
          <span className="text-2xl">🎧</span>
          <span className="text-xl font-bold">RadioApp</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="p-4 text-center text-purple-300 text-sm">
        <p>&copy; {new Date().getFullYear()} RadioApp. All rights reserved.</p>
      </footer>
    </div>
  );
}
