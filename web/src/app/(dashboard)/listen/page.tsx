'use client';

import { useState } from 'react';
import { RadioPlayer } from '@/components/radio/RadioPlayer';
import ChatSidebar from '@/components/chat/ChatSidebar';

export default function ListenPage() {
  const [showChat, setShowChat] = useState(true);

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Now Playing</h1>
            <p className="text-gray-600">
              Discover underground artists on RadioApp
            </p>
          </div>

          <RadioPlayer />

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>
              Everyone listening hears the same stream. <br />
              Like a song to save it and support the artist.
            </p>
          </div>

          {/* Mobile Chat Toggle */}
          <div className="mt-4 text-center lg:hidden">
            <button
              onClick={() => setShowChat(!showChat)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <span>💬</span>
              {showChat ? 'Hide Chat' : 'Show Chat'}
            </button>
          </div>
        </div>
      </div>

      {/* Chat Sidebar - Hidden on mobile unless toggled */}
      <div className={`${showChat ? 'block' : 'hidden'} lg:block`}>
        <ChatSidebar />
      </div>
    </div>
  );
}
