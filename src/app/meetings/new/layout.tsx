import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Schedule Meeting',
  description: 'Schedule a new ConnectSpace video conference with agenda and teammate invitations.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NewMeetingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
