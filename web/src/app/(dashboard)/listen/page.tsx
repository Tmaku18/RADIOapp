'use client';

import { useState } from 'react';
import { RadioPlayer } from '@/components/radio/RadioPlayer';
import ChatSidebar from '@/components/chat/ChatSidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ListenPage() {
  const [showChat, setShowChat] = useState(true);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex-1 min-h-0 overflow-y-auto p-8">
        <div className="min-h-full flex flex-col items-center justify-center">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">Now Playing</h1>
            <p className="text-muted-foreground">Discover underground artists on RadioApp</p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <RadioPlayer />
            </CardContent>
          </Card>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>Everyone listening hears the same stream. Like a song to save it and support the artist.</p>
          </div>

          <div className="mt-4 text-center lg:hidden">
            <Button onClick={() => setShowChat(!showChat)}>
              <span className="mr-2">💬</span>
              {showChat ? 'Hide Chat' : 'Show Chat'}
            </Button>
          </div>
        </div>
        </div>
      </div>

      <div className={`${showChat ? 'block' : 'hidden'} lg:block`}>
        <ChatSidebar />
      </div>
    </div>
  );
}
