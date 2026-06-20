// Mock app data for the Pro-Networx logged-in shell

export const me = {
  id: "me",
  name: "Kai Nova",
  handle: "@kainova",
  headline: "Multidisciplinary creative · Designer, Director, DJ",
  role: "Graphic Designer",
  city: "Brooklyn, NY",
  avatar: "https://images.pexels.com/photos/18569238/pexels-photo-18569238.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=320&w=320",
  banner: "https://images.pexels.com/photos/28494632/pexels-photo-28494632.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=420&w=1600",
  about:
    "Designer/director from Brooklyn. I make covers, posters and motion for underground artists. Currently building the visual system for Networx Radio. Open to collabs across music + identity.",
  skills: ["Brand systems", "Typography", "Motion", "Cover art", "Editorial", "Vinyl"],
  experience: [
    { role: "Visual Lead", company: "Networx Radio", from: "2024", to: "Present" },
    { role: "Senior Designer", company: "Wax & Whisper", from: "2021", to: "2024" },
    { role: "Designer", company: "Pentagram (intern)", from: "2020", to: "2021" },
  ],
  education: [
    { school: "RISD", degree: "BFA Graphic Design", year: "2020" },
  ],
  resume: "kai-nova-resume-2026.pdf",
  socials: { instagram: "kainova", twitter: "kainova", behance: "kainova", web: "kainova.studio" },
  pro: true,
  stats: { followers: 1247, following: 318, posts: 84, ripples: 612 },
};

export const feedPosts = [
  { id: 1, author: "Nova Lyra", handle: "@novalyra", avatar: "https://images.pexels.com/photos/29450016/pexels-photo-29450016.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=200&w=200", img: "https://images.pexels.com/photos/29450016/pexels-photo-29450016.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=900", caption: "New brand system for an underground label. Cyan + chrome forever. 🦋", likes: 412, comments: 38, time: "2h" },
  { id: 2, author: "Sora Beats", handle: "@sora808", avatar: "https://images.pexels.com/photos/28494632/pexels-photo-28494632.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=200&w=200", img: "https://images.pexels.com/photos/28494632/pexels-photo-28494632.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=900", caption: "808s and butterflies. New EP next month — leaks loading.", likes: 287, comments: 22, time: "5h" },
  { id: 3, author: "Mike Castro", handle: "@mikecastro", avatar: "https://images.pexels.com/photos/18569238/pexels-photo-18569238.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=200&w=200", img: "https://images.pexels.com/photos/18569238/pexels-photo-18569238.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=900", caption: "BTS from the Merkell cover shoot. Hard light, hard truths.", likes: 521, comments: 47, time: "8h" },
  { id: 4, author: "Echo Hayes", handle: "@echohayes", avatar: "https://images.pexels.com/photos/29450016/pexels-photo-29450016.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=200&w=200", img: "https://images.pexels.com/photos/28494632/pexels-photo-28494632.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=900", caption: "Color graded the new CrRon video. Teal/orange but make it feral.", likes: 198, comments: 14, time: "12h" },
  { id: 5, author: "Aria Flux", handle: "@ariaflux", avatar: "https://images.pexels.com/photos/18569238/pexels-photo-18569238.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=200&w=200", img: "https://images.pexels.com/photos/29450016/pexels-photo-29450016.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=900", caption: "Writing toplines for the next ProNetworx artist. Catalyst life.", likes: 134, comments: 9, time: "1d" },
];

const POOL = [
  "https://images.pexels.com/photos/29450016/pexels-photo-29450016.jpeg",
  "https://images.pexels.com/photos/18569238/pexels-photo-18569238.jpeg",
  "https://images.pexels.com/photos/28494632/pexels-photo-28494632.jpeg",
  "https://tgjydsqeatvcerzpdqup.supabase.co/storage/v1/object/public/artwork/acdbb0bf-e24f-48c7-bf7b-de3944c361de/1773694414102-53fe2372-019f-4b2d-b7e5-168de8f1f1ba.jpeg",
  "https://tgjydsqeatvcerzpdqup.supabase.co/storage/v1/object/public/artwork/71d9920d-ad65-4b9e-bad8-3a31bfcc2387/1774146327326-4b292260-8e5d-4a62-864f-de804e0836d3.jpeg",
  "https://tgjydsqeatvcerzpdqup.supabase.co/storage/v1/object/public/artwork/8f97c6b7-4652-4d4a-9caa-8e24822be70a/1773598248561-e0afcb8f-3ac9-4968-992e-c760ccf3705e.png",
  "https://tgjydsqeatvcerzpdqup.supabase.co/storage/v1/object/public/artwork/acdbb0bf-e24f-48c7-bf7b-de3944c361de/1774060477296-751b7736-3e4c-4d52-9d3c-4de5b0a5187a.png",
  "https://tgjydsqeatvcerzpdqup.supabase.co/storage/v1/object/public/artwork/ec72ceff-f419-4cb0-9dc1-c319f4c3508d/1773389567801-9c51aa70-73eb-426f-ba00-20706a1c3f9b.jpeg",
  "https://tgjydsqeatvcerzpdqup.supabase.co/storage/v1/object/public/artwork/acdbb0bf-e24f-48c7-bf7b-de3944c361de/1773866553231-68766584-e509-402b-b215-331df8d3d8f2.png",
];

const HANDLES = ["@novalyra", "@sora808", "@mikecastro", "@echohayes", "@ariaflux", "@kaiono", "@zenotis", "@riopetal", "@velamosa", "@cyrusnorth", "@ottovex", "@iriswren"];

export const explorePosts = Array.from({ length: 28 }, (_, i) => ({
  id: i + 100,
  img: POOL[i % POOL.length] + (POOL[i % POOL.length].includes("pexels") ? "?auto=compress&cs=tinysrgb&dpr=2&h=900&w=900" : ""),
  handle: HANDLES[i % HANDLES.length],
  likes: 80 + Math.floor(Math.random() * 600),
  span: i % 7 === 0 ? "tall" : i % 5 === 0 ? "wide" : "square",
}));

export const services = [
  { id: 1, title: "Cover art for a single", by: "Nova Lyra", handle: "@novalyra", role: "Graphic Designer", price: 180, eta: "3 days", img: POOL[3] + "?", tags: ["1 concept", "2 revisions", "Press kit ready"], verified: true },
  { id: 2, title: "Editorial portrait session", by: "Mike Castro", handle: "@mikecastro", role: "Photographer", price: 650, eta: "1 week", img: POOL[1] + "?auto=compress&cs=tinysrgb&dpr=2&h=900&w=900", tags: ["3hr studio", "20 edits", "License included"], verified: true },
  { id: 3, title: "Lo-fi beat (exclusive)", by: "Sora Beats", handle: "@sora808", role: "Beat Maker", price: 220, eta: "5 days", img: POOL[2] + "?auto=compress&cs=tinysrgb&dpr=2&h=900&w=900", tags: ["WAV stems", "Buyout", "1 revision"], verified: false },
  { id: 4, title: "Music video direction", by: "Echo Hayes", handle: "@echohayes", role: "Videographer", price: 2400, eta: "4 weeks", img: POOL[0] + "?auto=compress&cs=tinysrgb&dpr=2&h=900&w=900", tags: ["Treatment", "On-set direction", "Color grade"], verified: true },
  { id: 5, title: "Topline + hook writing", by: "Aria Flux", handle: "@ariaflux", role: "Lyricist", price: 140, eta: "4 days", img: POOL[4] + "", tags: ["2 toplines", "Vocal demo", "Unlimited tweaks"], verified: true },
  { id: 6, title: "Mix + master single", by: "Zen Otis", handle: "@zenotis", role: "Engineer", price: 380, eta: "1 week", img: POOL[5] + "", tags: ["32-track mix", "Mastered", "Stems"], verified: true },
  { id: 7, title: "Tour poster", by: "Vela Mosa", handle: "@velamosa", role: "Graphic Designer", price: 240, eta: "5 days", img: POOL[6] + "", tags: ["Print-ready", "Social variants", "2 concepts"], verified: false },
  { id: 8, title: "Comic-style illustration", by: "Kai Ono", handle: "@kaiono", role: "Illustrator", price: 320, eta: "1 week", img: POOL[7] + "", tags: ["Hand-drawn", "Color flats", "Hi-res"], verified: false },
];

export const conversations = [
  { id: 1, name: "Nova Lyra", handle: "@novalyra", avatar: POOL[0] + "?auto=compress&cs=tinysrgb&dpr=2&h=120&w=120", last: "Send me the brief when you can 👀", unread: 2, online: true, t: "now",
    messages: [
      { id: 1, from: "them", text: "Hey! Saw your work on the CrRon cover — fire.", t: "10:14" },
      { id: 2, from: "them", text: "Got room for a brand system gig in march?", t: "10:14" },
      { id: 3, from: "me", text: "Appreciate that. March is open. What's the artist?", t: "10:22" },
      { id: 4, from: "them", text: "Send me the brief when you can 👀", t: "10:24" },
    ],
  },
  { id: 2, name: "Mike Castro", handle: "@mikecastro", avatar: POOL[1] + "?auto=compress&cs=tinysrgb&dpr=2&h=120&w=120", last: "Studio confirmed for Friday.", unread: 0, online: true, t: "1h",
    messages: [
      { id: 1, from: "me", text: "Yo. Need editorial photos for the next Networx zine.", t: "Yesterday" },
      { id: 2, from: "them", text: "Studio confirmed for Friday.", t: "1h" },
    ],
  },
  { id: 3, name: "Sora Beats", handle: "@sora808", avatar: POOL[2] + "?auto=compress&cs=tinysrgb&dpr=2&h=120&w=120", last: "stems incoming 🥁", unread: 1, online: false, t: "3h",
    messages: [
      { id: 1, from: "them", text: "stems incoming 🥁", t: "3h" },
    ],
  },
  { id: 4, name: "Echo Hayes", handle: "@echohayes", avatar: POOL[0] + "?auto=compress&cs=tinysrgb&dpr=2&h=120&w=120", last: "Color reference moodboard saved.", unread: 0, online: false, t: "yesterday",
    messages: [
      { id: 1, from: "them", text: "Color reference moodboard saved.", t: "Yesterday" },
    ],
  },
  { id: 5, name: "Aria Flux", handle: "@ariaflux", avatar: POOL[1] + "?auto=compress&cs=tinysrgb&dpr=2&h=120&w=120", last: "Want me to write a hook?", unread: 0, online: true, t: "2d",
    messages: [
      { id: 1, from: "them", text: "Want me to write a hook?", t: "2 days ago" },
    ],
  },
];

export const suggestedFollows = [
  { name: "Zen Otis", handle: "@zenotis", role: "Engineer", img: POOL[1] + "?auto=compress&cs=tinysrgb&dpr=2&h=120&w=120" },
  { name: "Rio Petal", handle: "@riopetal", role: "Stylist", img: POOL[0] + "?auto=compress&cs=tinysrgb&dpr=2&h=120&w=120" },
  { name: "Otto Vex", handle: "@ottovex", role: "Beat Maker", img: POOL[2] + "?auto=compress&cs=tinysrgb&dpr=2&h=120&w=120" },
];
