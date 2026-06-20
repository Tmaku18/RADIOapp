import React, { useState } from "react";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, UserPlus } from "lucide-react";
import { feedPosts, suggestedFollows, me } from "@/data/proAppData";
import Reveal from "@/components/Reveal";

function FeedCard({ post }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <div data-testid={`feed-post-${post.id}`} className="rounded-2xl glass overflow-hidden">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <img src={post.avatar} alt={post.author} className="w-10 h-10 rounded-full object-cover ring-1 ring-cyan-400/40" />
          <div>
            <div className="font-unbounded font-bold text-sm">{post.author}</div>
            <div className="font-mono text-[10px] text-white/50">{post.handle} · {post.time}</div>
          </div>
        </div>
        <button className="text-white/50 hover:text-white"><MoreHorizontal className="w-4 h-4" /></button>
      </div>
      <div className="aspect-square bg-black">
        <img src={post.img} alt="" className="w-full h-full object-cover" loading="lazy" />
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <button
            data-testid={`feed-like-${post.id}`}
            onClick={() => setLiked(!liked)}
            className={`transition-colors ${liked ? "text-pink-400" : "text-white/80 hover:text-pink-400"}`}
          >
            <Heart className={`w-5 h-5 ${liked ? "fill-current" : ""}`} />
          </button>
          <button className="text-white/80 hover:text-cyan-300"><MessageCircle className="w-5 h-5" /></button>
          <button className="text-white/80 hover:text-cyan-300"><Send className="w-5 h-5" /></button>
          <button
            data-testid={`feed-save-${post.id}`}
            onClick={() => setSaved(!saved)}
            className={`ml-auto transition-colors ${saved ? "text-yellow-300" : "text-white/80 hover:text-yellow-300"}`}
          >
            <Bookmark className={`w-5 h-5 ${saved ? "fill-current" : ""}`} />
          </button>
        </div>
        <div className="text-sm">
          <span className="font-mono text-[10px] text-cyan-300 tracking-[0.15em]">
            {(post.likes + (liked ? 1 : 0)).toLocaleString()} RIPPLES
          </span>
        </div>
        <p className="text-sm text-white/85 mt-2 leading-relaxed">
          <span className="font-bold mr-1.5">{post.handle}</span>
          {post.caption}
        </p>
        <div className="font-mono text-[10px] text-white/40 mt-2">View all {post.comments} comments</div>
      </div>
    </div>
  );
}

export default function FeedPage() {
  return (
    <div data-testid="feed-page" className="grid lg:grid-cols-[1fr_300px] gap-6">
      <div className="space-y-6">
        <Reveal>
          <div>
            <h1 className="font-unbounded font-black tracking-tighter uppercase text-3xl md:text-4xl">
              Your <span className="text-glow-cyan text-cyan-300">feed</span>
            </h1>
            <p className="text-white/50 mt-1 text-sm">Posts from creatives you follow.</p>
          </div>
        </Reveal>

        {feedPosts.map((p, i) => (
          <Reveal key={p.id} delay={i * 0.05}>
            <FeedCard post={p} />
          </Reveal>
        ))}
      </div>

      <aside className="hidden lg:block space-y-4 sticky top-24 self-start">
        <div className="rounded-2xl glass p-5">
          <div className="flex items-center gap-3 mb-4">
            <img src={me.avatar} alt={me.name} className="w-12 h-12 rounded-full object-cover" />
            <div>
              <div className="font-unbounded font-bold">{me.name}</div>
              <div className="font-mono text-[10px] text-white/50">{me.handle}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center font-mono text-[10px] tracking-[0.15em]">
            <div><div className="font-unbounded text-cyan-300 text-base">{me.stats.posts}</div>POSTS</div>
            <div><div className="font-unbounded text-cyan-300 text-base">{me.stats.followers}</div>FOLLOWERS</div>
            <div><div className="font-unbounded text-cyan-300 text-base">{me.stats.following}</div>FOLLOWING</div>
          </div>
        </div>

        <div className="rounded-2xl glass p-5">
          <div className="font-mono text-[10px] tracking-[0.3em] text-pink-400 mb-4">SUGGESTED CATALYSTS</div>
          <div className="space-y-3">
            {suggestedFollows.map((s) => (
              <div key={s.handle} className="flex items-center gap-3">
                <img src={s.img} alt={s.name} className="w-10 h-10 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="font-unbounded font-bold text-sm truncate">{s.name}</div>
                  <div className="font-mono text-[10px] text-white/50">{s.role}</div>
                </div>
                <button
                  data-testid={`follow-${s.handle.replace("@","")}`}
                  className="px-3 py-1.5 rounded-full bg-cyan-400/15 border border-cyan-400/40 text-cyan-300 font-mono text-[9px] tracking-[0.2em] flex items-center gap-1 hover:bg-cyan-400/25"
                >
                  <UserPlus className="w-3 h-3" /> FOLLOW
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
