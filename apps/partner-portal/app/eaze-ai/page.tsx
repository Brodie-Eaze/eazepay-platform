'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRightIcon, RobotIcon, SparkIcon } from '@eazepay/ui/web';

/**
 * EAZE AI — direct port of Lovable's `/eaze-ai` page.
 *
 * Layout:
 *   ← Back to Dashboard
 *   AI ASSISTANT eyebrow
 *   "EAZE AI"
 *   "How can I help you today?"
 *   Subtitle: "I'm EAZE AI, your partner portal assistant…"
 *   6 quick-question chips in a 2-column grid
 *   Footer: "EAZE AI can make mistakes. Verify important information."
 */

const QUICK_PROMPTS = [
  'How do I submit an app?',
  'When do I get paid?',
  'Client objection help',
  'Client stuck on the app?',
  'What products are available?',
  'Tips to close more deals',
];

export default function EazeAiPage() {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="px-8 py-6 max-w-3xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-[12px] text-fg-muted hover:text-fg mb-4"
      >
        ← Back to Dashboard
      </Link>

      <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-fg-muted">
        AI Assistant
      </p>

      <div className="flex items-center gap-3 mt-1">
        <div className="h-12 w-12 rounded-xl bg-[#0d1530] text-white flex items-center justify-center">
          <RobotIcon size={22} />
        </div>
        <h1 className="text-fg leading-tight">EAZE AI</h1>
      </div>

      <h2 className="mt-6 text-[20px] font-semibold tracking-tight text-fg">
        How can I help you today?
      </h2>
      <p className="mt-2 text-[13px] text-fg-secondary max-w-xl">
        I&apos;m EAZE AI, your partner portal assistant. Ask me about applications, products,
        reports, or anything else.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setPicked(q)}
            className={
              'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all ' +
              (picked === q
                ? 'border-[#0d1530] bg-[#0d1530] text-white'
                : 'border-border bg-bg-elevated text-fg hover:border-border-strong')
            }
          >
            <span className="flex items-center gap-2.5">
              <SparkIcon size={14} className={picked === q ? 'text-white' : 'text-fg-muted'} />
              <span className="text-[13px] font-medium">{q}</span>
            </span>
            <ArrowRightIcon size={12} />
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-bg-elevated p-3 flex items-end gap-3">
        <textarea
          value={picked ?? ''}
          onChange={(e) => setPicked(e.target.value)}
          rows={2}
          placeholder="Ask EAZE AI anything…"
          className="flex-1 bg-transparent outline-none text-[14px] text-fg placeholder:text-fg-muted resize-none"
        />
        <button
          type="button"
          disabled={!picked}
          className="h-10 px-4 rounded-lg bg-[#0d1530] text-white font-semibold text-[13px] flex items-center gap-2 hover:bg-[#1a2a52] disabled:opacity-50"
        >
          Send
          <ArrowRightIcon size={12} />
        </button>
      </div>

      <p className="text-center text-[11px] text-fg-muted mt-6">
        EAZE AI can make mistakes. Verify important information.
      </p>
    </div>
  );
}
