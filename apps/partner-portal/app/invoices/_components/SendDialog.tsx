'use client';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Button,
} from '@eazepay/ui/web';

const inputCn =
  'mt-1 w-full h-9 rounded-md border border-border bg-bg-elevated px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-border-focus';
const textareaCn =
  'mt-1 w-full rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-[12px] font-mono outline-none focus:ring-2 focus:ring-border-focus';

export interface SendTarget {
  invoiceNo: string;
  merchant: string;
  email: string;
  subject: string;
  body: string;
}

interface Props {
  target: SendTarget | null;
  onClose: () => void;
  onSend: (final: { subject: string; body: string }) => void;
}

export function SendDialog({ target, onClose, onSend }: Props) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (target) {
      setSubject(target.subject);
      setBody(target.body);
    }
  }, [target]);

  if (!target) return <Dialog open={false} onOpenChange={() => onClose()} />;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Send invoice {target.invoiceNo}</DialogTitle>
          <DialogDescription>
            To: <strong className="text-fg">{target.email}</strong> · {target.merchant}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <span className="block text-[11px] uppercase tracking-wider font-semibold text-fg-muted">
              Subject
            </span>
            <input
              className={inputCn}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-wider font-semibold text-fg-muted">
              Body
            </span>
            <textarea
              className={textareaCn}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
            />
          </div>
          <p className="text-[11px] text-fg-muted">
            Opens your default mail client with this content pre-filled. After clicking Send you can
            review one last time in the composer before hitting send.
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button size="sm" onClick={() => onSend({ subject, body })}>
            Open mail composer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
