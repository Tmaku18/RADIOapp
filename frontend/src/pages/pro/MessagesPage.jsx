import React, { useState, useMemo } from "react";
import { Send, Search, Phone, Video, MoreHorizontal, Image as ImageIcon, Smile } from "lucide-react";
import { conversations as initialConvos } from "@/data/proAppData";

export default function MessagesPage() {
  const [convos, setConvos] = useState(initialConvos);
  const [activeId, setActiveId] = useState(convos[0].id);
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");

  const active = useMemo(() => convos.find((c) => c.id === activeId), [convos, activeId]);

  const filteredConvos = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return convos;
    return convos.filter(
      (c) => c.name.toLowerCase().includes(ql) || c.handle.toLowerCase().includes(ql)
    );
  }, [convos, q]);

  const send = () => {
    if (!draft.trim()) return;
    setConvos((cs) =>
      cs.map((c) =>
        c.id === activeId
          ? {
              ...c,
              last: draft,
              t: "now",
              messages: [...c.messages, { id: Date.now(), from: "me", text: draft, t: "now" }],
            }
          : c
      )
    );
    setDraft("");
  };

  return (
    <div data-testid="messages-page" className="h-[calc(100vh-8rem)] rounded-2xl glass overflow-hidden grid grid-cols-1 md:grid-cols-[300px_1fr]">
      {/* Conversations list */}
      <aside className="border-r border-white/10 flex flex-col min-h-0">
        <div className="p-4 border-b border-white/10">
          <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-3">MESSAGES</div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              data-testid="messages-search"
              placeholder="Search"
              className="w-full bg-black/60 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConvos.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              data-testid={`convo-${c.id}`}
              className={`w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-white/5 border-l-2 transition-colors ${
                c.id === activeId ? "bg-white/5 border-cyan-400" : "border-transparent"
              }`}
            >
              <div className="relative shrink-0">
                <img src={c.avatar} alt={c.name} className="w-11 h-11 rounded-full object-cover" />
                {c.online && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-cyan-400 ring-2 ring-black" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-unbounded font-bold text-sm truncate">{c.name}</span>
                  <span className="font-mono text-[9px] text-white/40 shrink-0">{c.t}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs text-white/55 truncate">{c.last}</span>
                  {c.unread > 0 && (
                    <span className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] font-bold">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat pane */}
      <section className="flex flex-col min-h-0" data-testid="chat-pane">
        {active ? (
          <>
            <header className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <img src={active.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <div className="font-unbounded font-bold text-sm">{active.name}</div>
                  <div className="font-mono text-[10px] text-cyan-300 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${active.online ? "bg-cyan-400" : "bg-white/30"}`} />
                    {active.online ? "ONLINE" : "OFFLINE"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="w-8 h-8 rounded-full border border-white/10 text-white/70 hover:text-cyan-300 hover:border-cyan-400/50 flex items-center justify-center"><Phone className="w-4 h-4" /></button>
                <button className="w-8 h-8 rounded-full border border-white/10 text-white/70 hover:text-cyan-300 hover:border-cyan-400/50 flex items-center justify-center"><Video className="w-4 h-4" /></button>
                <button className="w-8 h-8 rounded-full border border-white/10 text-white/70 hover:text-cyan-300 hover:border-cyan-400/50 flex items-center justify-center"><MoreHorizontal className="w-4 h-4" /></button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 cyber-grid" data-testid="chat-messages">
              {active.messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] px-4 py-2.5 text-sm leading-relaxed ${
                      m.from === "me"
                        ? "bg-cyan-400 text-black rounded-2xl rounded-br-md"
                        : "glass rounded-2xl rounded-bl-md"
                    }`}
                  >
                    {m.text}
                    <div className={`font-mono text-[9px] mt-1 tracking-[0.15em] ${m.from === "me" ? "text-black/60" : "text-white/40"}`}>
                      {m.t}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              className="p-4 border-t border-white/10 flex items-center gap-3 shrink-0"
            >
              <button type="button" className="text-white/50 hover:text-cyan-300"><ImageIcon className="w-4 h-4" /></button>
              <button type="button" className="text-white/50 hover:text-cyan-300"><Smile className="w-4 h-4" /></button>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                data-testid="message-input"
                placeholder="Send a frequency…"
                className="flex-1 bg-black/60 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-white/30 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                data-testid="message-send"
                className="w-10 h-10 rounded-full bg-cyan-400 text-black flex items-center justify-center glow-cyan hover:bg-white"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/40 font-mono text-sm">
            Pick a conversation
          </div>
        )}
      </section>
    </div>
  );
}
