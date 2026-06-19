import React, { useState } from "react";
import { Mail, Send, Terminal } from "lucide-react";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setForm({ name: "", email: "", message: "" });
    }, 4000);
  };

  return (
    <div className="relative pt-28 pb-40 min-h-screen" data-testid="contact-page">
      <div className="max-w-5xl mx-auto px-6 lg:px-10">
        <div className="mb-12">
          <div className="font-mono text-[10px] tracking-[0.3em] text-pink-400 mb-2">◤ TRANSMIT</div>
          <h1 className="font-unbounded font-black tracking-tighter uppercase text-5xl md:text-7xl">
            Get in <span className="text-glow-pink text-pink-400">touch</span>
          </h1>
          <p className="text-white/60 mt-3 max-w-xl">
            Send us a frequency. Pitch your show. Tell us what's bumping. We read everything.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 rounded-2xl glass p-6 md:p-8">
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-6">
              <Terminal className="w-3 h-3" /> /networx/transmit
            </div>
            <form onSubmit={onSubmit} className="space-y-5" data-testid="contact-form">
              <div>
                <label className="font-mono text-[10px] tracking-[0.25em] text-white/50 uppercase">
                  Handle
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="dj_frequency"
                  data-testid="contact-name"
                  className="mt-2 w-full bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-400 focus:glow-cyan transition-all"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-[0.25em] text-white/50 uppercase">
                  Frequency (email)
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@networx.fm"
                  data-testid="contact-email"
                  className="mt-2 w-full bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-400 focus:glow-cyan transition-all"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-[0.25em] text-white/50 uppercase">
                  Signal
                </label>
                <textarea
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Drop your message into the static..."
                  data-testid="contact-message"
                  className="mt-2 w-full bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-pink-400 transition-all resize-none"
                />
              </div>
              <button
                type="submit"
                data-testid="contact-submit"
                className="inline-flex items-center gap-3 px-7 py-3 rounded-full bg-cyan-400 text-black font-mono text-[11px] tracking-[0.25em] uppercase font-bold glow-cyan hover:bg-white transition-colors"
              >
                {sent ? "Transmitted ✓" : <>Transmit <Send className="w-4 h-4" /></>}
              </button>
            </form>
          </div>

          <aside className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl glass p-6">
              <Mail className="w-5 h-5 text-cyan-300 mb-3" />
              <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-1">DIRECT LINE</div>
              <div className="font-unbounded font-bold text-lg">hello@networxradio.com</div>
            </div>
            <div className="rounded-2xl glass p-6">
              <div className="font-mono text-[10px] tracking-[0.3em] text-pink-400 mb-3">PITCH A SHOW</div>
              <p className="text-white/70 text-sm leading-relaxed">
                Are you a DJ, producer, or curator with a sound that bends the frequency?
                Slide into our DMs. We're always digging for catalysts.
              </p>
            </div>
            <div className="rounded-2xl glass p-6">
              <div className="font-mono text-[10px] tracking-[0.3em] text-yellow-300 mb-3">FOLLOW THE WAKE</div>
              <p className="text-white/70 text-sm leading-relaxed">
                @networxradio across the socials. Watch the temperature rise in real time.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
