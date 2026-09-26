import type { Metadata } from 'next';
import './globals.css';
import './studio-theme.css';
import { StudioThemeProvider } from '@/components/shared/StudioTheme';
export const metadata: Metadata = {
  title: 'Forma · Teaching Studio',
  description:
    'A voice-controlled 3D classroom for orthodontic demonstrations. Explore tooth movements, brackets, roots, attachments, and guided teaching sequences.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <StudioThemeProvider>{children}</StudioThemeProvider>
      </body>
    </html>
  );
}
