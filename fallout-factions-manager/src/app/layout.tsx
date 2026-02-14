import type { Metadata } from 'next';
import { App, ConfigProvider } from 'antd';
import { AntdNotifyBridge } from '@/components/providers/AntdNotifyBridge';
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
        <ConfigProvider theme={falloutTheme}>
          <App>
            <AntdNotifyBridge />
            {children}
          </App>
        </ConfigProvider>
      </body>
    </html>
  );
}
