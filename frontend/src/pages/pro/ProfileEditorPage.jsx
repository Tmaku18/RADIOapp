import React, { useState } from "react";
import { Camera, Plus, Trash2, FileText, Save, Globe, Instagram, Twitter, ShieldCheck, X } from "lucide-react";
import { me as seed } from "@/data/proAppData";

function Section({ title, color = "cyan-300", children, action }) {
  return (
    <div className="rounded-2xl glass p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`font-mono text-[10px] tracking-[0.3em] text-${color}`}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function ProfileEditorPage() {
  const [p, setP] = useState(seed);
  const [savedAt, setSavedAt] = useState(null);
  const [skillDraft, setSkillDraft] = useState("");

  const upd = (k, v) => setP({ ...p, [k]: v });
  const updSocial = (k, v) => setP({ ...p, socials: { ...p.socials, [k]: v } });

  const addSkill = () => {
    const s = skillDraft.trim();
    if (!s || p.skills.includes(s)) return;
    setP({ ...p, skills: [...p.skills, s] });
    setSkillDraft("");
  };

  const removeSkill = (s) => setP({ ...p, skills: p.skills.filter((x) => x !== s) });

  const addExp = () =>
    setP({ ...p, experience: [{ role: "New role", company: "Company", from: "2026", to: "Present" }, ...p.experience] });
  const removeExp = (i) =>
    setP({ ...p, experience: p.experience.filter((_, idx) => idx !== i) });
  const updExp = (i, k, v) =>
    setP({
      ...p,
      experience: p.experience.map((e, idx) => (idx === i ? { ...e, [k]: v } : e)),
    });

  const save = (e) => {
    e?.preventDefault();
    setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    setTimeout(() => setSavedAt(null), 3000);
  };

  return (
    <form onSubmit={save} data-testid="profile-editor-page" className="space-y-5">
      {/* Banner + avatar */}
      <div className="relative rounded-2xl glass overflow-hidden">
        <div className="aspect-[5/1] relative bg-black">
          <img src={p.banner} alt="" className="w-full h-full object-cover opacity-80" />
          <button type="button" data-testid="banner-edit" className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/70 border border-cyan-400/40 text-cyan-300 font-mono text-[10px] tracking-[0.2em] flex items-center gap-1.5 hover:bg-black/90">
            <Camera className="w-3 h-3" /> EDIT BANNER
          </button>
        </div>
        <div className="px-6 pb-6 -mt-12 flex flex-col md:flex-row md:items-end gap-5">
          <div className="relative shrink-0">
            <img src={p.avatar} alt={p.name} className="w-24 h-24 md:w-28 md:h-28 rounded-2xl object-cover ring-4 ring-black" />
            <button type="button" data-testid="avatar-edit" className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-cyan-400 text-black flex items-center justify-center glow-cyan hover:bg-white">
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-2">
              <h1 className="font-unbounded font-black text-3xl md:text-4xl tracking-tight">{p.name}</h1>
              {p.pro && (
                <span className="px-2 py-0.5 rounded-full bg-cyan-400/15 border border-cyan-400/40 text-cyan-300 font-mono text-[9px] tracking-[0.2em] flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> PRO
                </span>
              )}
            </div>
            <div className="font-mono text-[11px] text-white/50">{p.handle} · {p.city}</div>
          </div>
          <button
            type="submit"
            data-testid="profile-save"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-400 text-black font-mono text-[11px] tracking-[0.25em] uppercase font-bold glow-cyan hover:bg-white"
          >
            <Save className="w-4 h-4" /> {savedAt ? `Saved · ${savedAt}` : "Save changes"}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-5">
          {/* Headline + about */}
          <Section title="HEADLINE & ABOUT">
            <label className="font-mono text-[10px] tracking-[0.2em] text-white/50 uppercase">Headline</label>
            <input
              data-testid="profile-headline"
              value={p.headline}
              onChange={(e) => upd("headline", e.target.value)}
              className="mt-1.5 w-full bg-black/60 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400"
            />
            <label className="font-mono text-[10px] tracking-[0.2em] text-white/50 uppercase mt-4 block">About</label>
            <textarea
              data-testid="profile-about"
              rows={5}
              value={p.about}
              onChange={(e) => upd("about", e.target.value)}
              className="mt-1.5 w-full bg-black/60 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-400 resize-none"
            />
          </Section>

          {/* Skills */}
          <Section
            title="SKILLS"
            color="pink-400"
            action={
              <div className="flex items-center gap-2">
                <input
                  data-testid="skill-input"
                  value={skillDraft}
                  onChange={(e) => setSkillDraft(e.target.value)}
                  placeholder="add skill"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                  className="bg-black/60 border border-white/10 rounded px-2.5 py-1 text-xs w-28 focus:outline-none focus:border-pink-400"
                />
                <button type="button" data-testid="skill-add" onClick={addSkill} className="w-7 h-7 rounded-full bg-pink-500/20 border border-pink-400/40 text-pink-300 flex items-center justify-center hover:bg-pink-500/30">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            }
          >
            <div className="flex flex-wrap gap-2">
              {p.skills.map((s) => (
                <span key={s} data-testid={`skill-${s.replace(/\s/g, "-").toLowerCase()}`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-500/10 border border-pink-400/30 text-pink-300 font-mono text-[10px] tracking-[0.15em]">
                  {s}
                  <button type="button" onClick={() => removeSkill(s)} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </Section>

          {/* Experience */}
          <Section
            title="EXPERIENCE"
            color="yellow-300"
            action={
              <button type="button" data-testid="exp-add" onClick={addExp} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-yellow-300/15 border border-yellow-300/40 text-yellow-300 font-mono text-[10px] tracking-[0.2em] hover:bg-yellow-300/25">
                <Plus className="w-3 h-3" /> ADD
              </button>
            }
          >
            <div className="space-y-3">
              {p.experience.map((e, i) => (
                <div key={i} data-testid={`exp-row-${i}`} className="rounded-lg border border-white/10 p-3 bg-black/40">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px_120px_36px] gap-2">
                    <input value={e.role} onChange={(ev) => updExp(i, "role", ev.target.value)} className="bg-black/60 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-300" />
                    <input value={e.company} onChange={(ev) => updExp(i, "company", ev.target.value)} className="bg-black/60 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-300" />
                    <input value={e.from} onChange={(ev) => updExp(i, "from", ev.target.value)} className="bg-black/60 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-300" />
                    <input value={e.to} onChange={(ev) => updExp(i, "to", ev.target.value)} className="bg-black/60 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-300" />
                    <button type="button" onClick={() => removeExp(i)} className="rounded bg-white/5 hover:bg-pink-500/20 hover:text-pink-300 text-white/50 flex items-center justify-center">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="space-y-5">
          {/* Resume */}
          <Section title="RESUME">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-black/50 border border-white/10">
              <FileText className="w-5 h-5 text-cyan-300" />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[11px] truncate">{p.resume}</div>
                <div className="font-mono text-[9px] text-white/40">PDF · 0.4 MB</div>
              </div>
              <button type="button" data-testid="resume-replace" className="font-mono text-[10px] tracking-[0.2em] text-cyan-300 hover:text-white">REPLACE</button>
            </div>
          </Section>

          {/* Socials */}
          <Section title="SOCIALS" color="pink-400">
            {[
              { k: "instagram", label: "Instagram", Icon: Instagram },
              { k: "twitter", label: "Twitter / X", Icon: Twitter },
              { k: "behance", label: "Behance", Icon: Globe },
              { k: "web", label: "Website", Icon: Globe },
            ].map(({ k, label, Icon }) => (
              <div key={k} className="flex items-center gap-2 mb-2">
                <Icon className="w-3.5 h-3.5 text-white/50 shrink-0" />
                <span className="font-mono text-[10px] text-white/50 w-20 shrink-0">{label}</span>
                <input
                  data-testid={`social-${k}`}
                  value={p.socials[k] || ""}
                  onChange={(e) => updSocial(k, e.target.value)}
                  className="flex-1 bg-black/60 border border-white/10 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-pink-400"
                />
              </div>
            ))}
          </Section>

          {/* Stats */}
          <Section title="THE WAKE" color="yellow-300">
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(p.stats).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-white/10 p-3 bg-black/40">
                  <div className="font-unbounded font-black text-2xl text-cyan-300">{v.toLocaleString()}</div>
                  <div className="font-mono text-[9px] tracking-[0.2em] text-white/50 uppercase">{k}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </form>
  );
}
