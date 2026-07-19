'use client';

import { useState } from 'react';
import { MoreHorizontal, Flag, Ban, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { discoveryApi, usersApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ReportReasonDialog } from './ReportReasonDialog';

type ReportTarget = 'post' | 'user' | null;

interface UserSafetyMenuProps {
  userId: string;
  displayName?: string | null;
  postId?: string;
  blockedByMe?: boolean;
  onBlocked?: () => void;
  onUnblocked?: () => void;
  onPostHidden?: () => void;
  buttonClassName?: string;
}

function apiErrorMessage(err: unknown, fallback: string): string {
  const serverMessage = (
    err as { response?: { data?: { message?: string } } }
  )?.response?.data?.message;
  if (typeof serverMessage === 'string' && serverMessage.trim()) {
    return serverMessage;
  }
  return fallback;
}

export function UserSafetyMenu({
  userId,
  displayName,
  postId,
  blockedByMe = false,
  onBlocked,
  onUnblocked,
  onPostHidden,
  buttonClassName,
}: UserSafetyMenuProps) {
  const label = displayName?.trim() || 'this user';
  const [reportTarget, setReportTarget] = useState<ReportTarget>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);

  const submitReport = async (reason: string) => {
    setReportSubmitting(true);
    try {
      if (reportTarget === 'post' && postId) {
        await discoveryApi.reportPost(postId, reason);
        toast.success('Post reported. Our team will review it.');
        onPostHidden?.();
      } else {
        await usersApi.reportUser(userId, {
          reason,
          contextType: postId ? 'post' : 'profile',
          contextId: postId,
        });
        toast.success('Report submitted. Our team will review it.');
      }
      setReportTarget(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not submit report.'));
    } finally {
      setReportSubmitting(false);
    }
  };

  const confirmBlock = async () => {
    setBlockBusy(true);
    try {
      await usersApi.blockUser(userId);
      toast.success(`Blocked ${label}.`);
      setBlockDialogOpen(false);
      onBlocked?.();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not block this user.'));
    } finally {
      setBlockBusy(false);
    }
  };

  const handleUnblock = async () => {
    setBlockBusy(true);
    try {
      await usersApi.unblockUser(userId);
      toast.success(`Unblocked ${label}.`);
      onUnblocked?.();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not unblock this user.'));
    } finally {
      setBlockBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={buttonClassName ?? 'h-8 w-8 shrink-0 text-muted-foreground'}
            aria-label="More options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {postId && (
            <DropdownMenuItem onClick={() => setReportTarget('post')}>
              <Flag className="mr-2 h-4 w-4" />
              Report post
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setReportTarget('user')}>
            <Flag className="mr-2 h-4 w-4" />
            Report {label}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {blockedByMe ? (
            <DropdownMenuItem onClick={() => void handleUnblock()} disabled={blockBusy}>
              <ShieldOff className="mr-2 h-4 w-4" />
              Unblock {label}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => setBlockDialogOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Ban className="mr-2 h-4 w-4" />
              Block {label}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportReasonDialog
        open={reportTarget != null}
        onOpenChange={(open) => {
          if (!open) setReportTarget(null);
        }}
        title={reportTarget === 'post' ? 'Report post' : `Report ${label}`}
        description={
          reportTarget === 'post'
            ? 'Tell us why this post should be reviewed. Reports are confidential.'
            : `Tell us why ${label} should be reviewed. Reports are confidential.`
        }
        submitting={reportSubmitting}
        onSubmit={submitReport}
      />

      <AlertDialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              They won&apos;t be able to message you, and you won&apos;t see
              their posts in your feed. You can unblock them anytime in Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={blockBusy}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={blockBusy}
              onClick={() => void confirmBlock()}
            >
              {blockBusy ? 'Blocking…' : 'Block'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
