import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RUIN SIGHT | 폐허의 사수',
  description: '도시 폐허 속에서 나타나는 적을 단 한 발로 조준하는 1인칭 슈팅 게임입니다.',
  applicationName: 'RUIN SIGHT',
  openGraph: {
    title: 'RUIN SIGHT | 폐허의 사수',
    description: '도시 폐허 속에서 나타나는 적을 단 한 발로 조준하는 1인칭 슈팅 게임입니다.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'RUIN SIGHT 폐허의 사수' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RUIN SIGHT | 폐허의 사수',
    description: '도시 폐허 속에서 나타나는 적을 단 한 발로 조준하는 1인칭 슈팅 게임입니다.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
