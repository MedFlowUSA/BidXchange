import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BidXchange | Your contract desk',
  description: 'Find the right opportunities. Build a confident pursuit.',
  robots: { index: false, follow: false },
  icons: { icon: '/brand/bidxchange-icon.png?v=2', apple: '/brand/bidxchange-icon.png?v=2' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
