'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export const REPORT_REASONS = [
  'Spam',
  'Harassment or hate',
  'Inappropriate content',
  'Impersonation',
  'Other',
] as const;

interface ReportReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitting?: boolean;
  onSubmit: (reason: string) => void | Promise<void>;
}

export function ReportReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  submitting = false,
  onSubmit,
}: ReportReasonDialogProps) {
  const [selected, setSelected] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');

  const handleSubmit = async () => {
    const base = selected.trim();
    const extra = details.trim();
    const reason =
      selected === 'Other'
        ? extra || base
        : extra
          ? `${base}: ${extra}`
          : base;
    if (!reason.trim()) return;
    await onSubmit(reason.trim().slice(0, 2000));
    setDetails('');
    setSelected(REPORT_REASONS[0]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {REPORT_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => setSelected(reason)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm transition-colors',
                  selected === reason
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {reason}
              </button>
            ))}
          </div>
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={
              selected === 'Other'
                ? 'Describe the issue…'
                : 'Add details (optional)…'
            }
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={submitting || (selected === 'Other' && !details.trim())}
            onClick={() => void handleSubmit()}
          >
            {submitting ? 'Submitting…' : 'Submit report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
