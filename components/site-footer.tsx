import { FeedbackButton } from "@/components/feedback-button";

/** Shared footer: brand line, X account, feedback entry point. */
export function SiteFooter() {
  return (
    <footer className="text-center text-[10px] text-muted-foreground py-6 border-t space-y-2">
      <p className="font-bold uppercase tracking-widest">
        Side Quest Philadelphia
      </p>
      <p>Summer 2026 ... Celebrating 250 years of America</p>
      <p className="space-x-1.5">
        <span className="font-bold">@SideQuestPhilly</span>
        <span>·</span>
        <a
          href="https://x.com/SideQuestPhilly"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-[#C9A84C] hover:underline"
        >
          X
        </a>
        <span>·</span>
        <a
          href="https://www.instagram.com/sidequestphilly"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-[#C9A84C] hover:underline"
        >
          Instagram
        </a>
        <span>·</span>
        <span>#SideQuestPhilly</span>
      </p>
      <FeedbackButton />
    </footer>
  );
}
