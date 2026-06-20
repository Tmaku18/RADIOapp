// Mock ProNetworx data — based on real site content

export const disciplines = [
  { icon: "Palette", label: "Graphic Designers", count: 24, color: "cyan" },
  { icon: "Camera", label: "Photographers", count: 31, color: "pink" },
  { icon: "Film", label: "Videographers", count: 18, color: "yellow" },
  { icon: "Brush", label: "Illustrators", count: 14, color: "cyan" },
  { icon: "Mic", label: "Lyricists", count: 22, color: "pink" },
  { icon: "Drum", label: "Beat Makers", count: 29, color: "yellow" },
  { icon: "SlidersHorizontal", label: "Engineers", count: 12, color: "cyan" },
  { icon: "Shirt", label: "Stylists", count: 9, color: "pink" },
];

export const proFeatures = [
  {
    title: "LinkedIn-style profile",
    body: "Banner, avatar, headline, about, skills, experience, education, resume PDF, and links to every social.",
    icon: "IdCard",
    color: "cyan",
  },
  {
    title: "Instagram-style feed",
    body: "Home shows posts from people you follow. Search opens a tile grid you can scroll forever.",
    icon: "LayoutGrid",
    color: "pink",
  },
  {
    title: "Services marketplace",
    body: "List what you do, set a price, and let buyers find you. Contact info revealed to subscribers.",
    icon: "ShoppingBag",
    color: "yellow",
  },
  {
    title: "Direct messaging",
    body: "Message anyone with an active subscription — no follow gate, no friction.",
    icon: "MessageSquare",
    color: "cyan",
  },
  {
    title: "Background radio",
    body: "Tap the Radio tab to keep Networx Radio playing while you scroll.",
    icon: "Radio",
    color: "pink",
  },
  {
    title: "One account, both worlds",
    body: "Your Pro-Networx profile is auto-seeded from Networx Radio, and vice versa.",
    icon: "Infinity",
    color: "yellow",
  },
];

export const directory = [
  { id: 1, name: "Nova Lyra", handle: "@novalyra", role: "Graphic Designer", city: "Lagos", rate: 60, skills: ["Brand systems", "Posters", "Type"], img: "https://images.pexels.com/photos/29450016/pexels-photo-29450016.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", verified: true },
  { id: 2, name: "Mike Castro", handle: "@mikecastro", role: "Photographer", city: "Brooklyn", rate: 250, skills: ["Editorial", "Portraits", "Live"], img: "https://images.pexels.com/photos/18569238/pexels-photo-18569238.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", verified: true },
  { id: 3, name: "Sora Beats", handle: "@sora808", role: "Beat Maker", city: "Tokyo", rate: 120, skills: ["Trap", "Lo-fi", "Drill"], img: "https://images.pexels.com/photos/28494632/pexels-photo-28494632.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", verified: false },
  { id: 4, name: "Echo Hayes", handle: "@echohayes", role: "Videographer", city: "Atlanta", rate: 400, skills: ["Music videos", "BTS", "Color"], img: "https://images.pexels.com/photos/29450016/pexels-photo-29450016.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", verified: true },
  { id: 5, name: "Aria Flux", handle: "@ariaflux", role: "Lyricist", city: "London", rate: 80, skills: ["Topline", "Hooks", "Storytelling"], img: "https://images.pexels.com/photos/18569238/pexels-photo-18569238.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", verified: true },
  { id: 6, name: "Kai Ono", handle: "@kaiono", role: "Illustrator", city: "Toronto", rate: 95, skills: ["Cover art", "Comics", "Concept"], img: "https://images.pexels.com/photos/28494632/pexels-photo-28494632.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", verified: false },
  { id: 7, name: "Zen Otis", handle: "@zenotis", role: "Engineer", city: "LA", rate: 180, skills: ["Mix", "Master", "Vocal chain"], img: "https://images.pexels.com/photos/29450016/pexels-photo-29450016.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", verified: true },
  { id: 8, name: "Rio Petal", handle: "@riopetal", role: "Stylist", city: "Paris", rate: 220, skills: ["Editorial", "Performance", "Vintage"], img: "https://images.pexels.com/photos/18569238/pexels-photo-18569238.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", verified: false },
  { id: 9, name: "Vela Mosa", handle: "@velamosa", role: "Graphic Designer", city: "São Paulo", rate: 75, skills: ["Posters", "Merch", "Motion"], img: "https://images.pexels.com/photos/29450016/pexels-photo-29450016.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", verified: false },
  { id: 10, name: "Cyrus North", handle: "@cyrusnorth", role: "Photographer", city: "Berlin", rate: 200, skills: ["Studio", "Street", "Analog"], img: "https://images.pexels.com/photos/18569238/pexels-photo-18569238.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", verified: true },
  { id: 11, name: "Otto Vex", handle: "@ottovex", role: "Beat Maker", city: "Detroit", rate: 110, skills: ["House", "Techno", "Sample"], img: "https://images.pexels.com/photos/28494632/pexels-photo-28494632.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", verified: true },
  { id: 12, name: "Iris Wren", handle: "@iriswren", role: "Videographer", city: "Seoul", rate: 350, skills: ["Music video", "Edit", "VFX"], img: "https://images.pexels.com/photos/29450016/pexels-photo-29450016.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", verified: false },
];

export const proPricing = {
  intro: 4.99,
  monthly: 9.99,
  perks: [
    "Send DMs to anyone with an active subscription",
    "View contact info on services listings",
    "Unlimited posts to the feed",
    "List unlimited services in the marketplace",
    "Verified badge eligibility after 30 days",
    "Background radio keeps Networx playing as you scroll",
  ],
  free: [
    "Browse the directory & feed",
    "Build your full profile",
    "Post to the feed",
    "Listen to Networx Radio",
  ],
};

export const proStats = {
  catalysts: 159,
  countries: 24,
  disciplines: 8,
  matchesThisMonth: 412,
};
