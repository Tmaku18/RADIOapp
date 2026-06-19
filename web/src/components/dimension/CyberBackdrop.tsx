'use client';

export function CyberBackdrop() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
      <div className="absolute inset-0 cyber-grid opacity-30" />
      <div className="absolute inset-0 bg-gradient-radial-dim" />
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-[120px]" />
      <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full bg-pink-500/10 blur-[140px]" />
      <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] rounded-full bg-yellow-500/5 blur-[120px]" />
    </div>
  );
}
