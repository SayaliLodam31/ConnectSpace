import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Meetings',
  description: 'Manage, schedule, and join ConnectSpace video conferences.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function MeetingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
