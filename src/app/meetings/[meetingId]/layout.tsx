import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Video Meeting',
  description: 'Live real-time video conference and collaboration space on ConnectSpace.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function MeetingRoomLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
