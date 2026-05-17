'use client';
import type { FC, ReactNode } from 'react';
import { useState } from 'react';
import { cn } from './cn';
import { CopyIcon, CheckIcon } from './Icon';

/**
 * Read-only code block with a copy button. Used in the developer
 * portal and on the API key reveal screens.
 */
export const CodeBlock: FC<{
  children: string;
  language?: string;
  filename?: string;
  className?: string;
  /** Show line numbers on the left gutter */
  showLineNumbers?: boolean;
}> = ({ children, language, filename, className, showLineNumbers = true }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard blocked — visually no-op rather than throwing.
    }
  };

  const lines = children.split('\n');

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-[rgb(11,13,18)] overflow-hidden text-[13px] font-mono',
        className,
      )}
    >
      {(filename || language) && (
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[12px] text-white/60">
          <span>{filename ?? language}</span>
          {language && filename && <span className="text-white/40">{language}</span>}
        </div>
      )}
      <div className="relative">
        <button
          onClick={copy}
          aria-label="Copy code"
          className="absolute right-3 top-3 rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80 hover:bg-white/10 transition-colors flex items-center gap-1"
        >
          {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <pre className="overflow-x-auto p-4 text-white/90 leading-relaxed">
          <code>
            {lines.map((l, i) => (
              <div key={i} className="flex">
                {showLineNumbers && (
                  <span className="select-none w-8 shrink-0 text-white/30 text-right pr-3">
                    {i + 1}
                  </span>
                )}
                <span className="whitespace-pre">{l || ' '}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
};

/** Inline code snippet, e.g. variable names in prose. */
export const InlineCode: FC<{ children: ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <code
    className={cn(
      'font-mono text-[12.5px] bg-bg-muted text-fg-secondary px-1.5 py-0.5 rounded',
      className,
    )}
  >
    {children}
  </code>
);
