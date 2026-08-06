import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kisan Vani — AI Voice Companion for Farmers',
  description: 'Sub-100ms regional voice AI companion for 140M+ Indian farmers powered by Murf Falcon 2 & Agri-LLM.',
  keywords: ['Kisan Vani', 'Murf AI', 'Voice for Bharat', 'Agri AI', 'Falcon 2', 'Indian Regional Voices'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-[#020704] text-slate-100">{children}</body>
    </html>
  );
}
