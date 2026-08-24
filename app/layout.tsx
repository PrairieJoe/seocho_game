import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Neon Survivor | 탑다운 슈팅게임',
  description: '끝없이 몰려오는 적을 피해 살아남는 네온 탑다운 슈팅게임입니다.',
  applicationName: 'Neon Survivor',
  openGraph: {
    title: 'Neon Survivor | 끝까지 버텨라',
    description: '끝없이 몰려오는 적을 피해 살아남는 네온 탑다운 슈팅게임입니다.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Neon Survivor 게임 미리보기' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Neon Survivor | 끝까지 버텨라',
    description: '끝없이 몰려오는 적을 피해 살아남는 네온 탑다운 슈팅게임입니다.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
