export default function OfflinePage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center rounded-2xl border border-border bg-background/60 p-8">
        <div className="text-5xl mb-4">📻</div>
        <h1 className="text-2xl font-bold text-foreground">You’re offline</h1>
        <p className="text-muted-foreground mt-3">
          The app shell is available, but live radio and realtime features need a connection.
        </p>
        <p className="text-muted-foreground mt-2">
          Reconnect to continue listening.
        </p>
      </div>
    </div>
  );
}

