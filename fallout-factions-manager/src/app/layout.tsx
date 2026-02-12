import type { Metadata } from 'next';
import { ConfigProvider } from 'antd';
import { falloutTheme } from '@/lib/ui/theme';
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
      <body className="antialiased">
        <ConfigProvider theme={falloutTheme}>{children}</ConfigProvider>
      </body>
    </html>
  );
}
