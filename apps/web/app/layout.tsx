import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BidXchange | Your contract desk',
  description: 'Find the right opportunities. Build a confident pursuit.',
  icons: { icon: '/brand/bidxchange-icon.png' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
