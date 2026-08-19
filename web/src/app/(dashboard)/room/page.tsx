'use client';

import ChatSidebar from '@/components/chat/ChatSidebar';

export default function ChatRoomPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">The Chat Room</h1>
        <p className="text-sm text-muted-foreground">
          The global lounge — station chat stays on the Radio page.
        </p>
      </div>
      <div className="h-[calc(100vh-12rem)] min-h-[480px] overflow-hidden rounded-xl border border-border">
        <ChatSidebar radioId="global" standalone />
      </div>
    </div>
  );
}
