import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agent Studio',
  description: 'Multi-stage LLM agent platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <div className="app-shell">
          <header className="app-header">
            <Link href="/" className="logo">
              Agent Studio
            </Link>
            <nav className="app-nav">
              <Link href="/agents">Agents</Link>
              <Link href="/runs">Runs</Link>
            </nav>
          </header>
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
