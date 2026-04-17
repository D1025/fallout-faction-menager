import type { Metadata } from 'next';
import { App, ConfigProvider } from 'antd';
import { AntdNotifyBridge } from '@/components/providers/AntdNotifyBridge';
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider';
import { Auth401Guard } from '@/components/auth/Auth401Guard';
import { falloutTheme } from '@/lib/ui/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fallout Factions Manager',
  description: 'Mobile army and campaign tracker for a Fallout tabletop game.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ConfigProvider theme={falloutTheme}>
          <ReactQueryProvider>
            <App>
              <AntdNotifyBridge />
              <Auth401Guard />
              {children}
            </App>
          </ReactQueryProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
