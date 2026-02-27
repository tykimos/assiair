import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Assiair',
  description: 'AI Assistant',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
        {children}
      </body>
    </html>
  );
}
