import { MeetShell } from "@/components/meet-shell";

export default function MeetLayout({ children }: { children: React.ReactNode }) {
  return <MeetShell>{children}</MeetShell>;
}
