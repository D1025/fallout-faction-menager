import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fallout Factions Manager',
  description: 'Mobilny tracker armii i kampanii do gry bitewnej w świecie Fallouta.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
