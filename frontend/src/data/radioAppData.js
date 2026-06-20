// Mock data for logged-in Networx Radio app

import { trendingSongs, trendingArtists, schedule, platformStats } from "@/data/mockData";

export const radioMe = {
  name: "Tanaka",
  handle: "@tanakamak",
  role: "Admin",
  avatar: "https://tgjydsqeatvcerzpdqup.supabase.co/storage/v1/object/public/avatars/42355097-38e8-46c4-93e5-f699ad79e714/profiles/2f5f2875-4c4f-44f8-b330-318457dc939f.png",
  rewards: 248.75,
  yield: 612,
  level: "Diamond Prospector",
};

export const liveDjs = [
  { id: 1, name: "DJ Frequency", show: "Underground Pulse", listeners: 142, live: true, img: trendingSongs[0].img, genre: "Hip-Hop / Trap" },
  { id: 2, name: "CrRon", show: "Metamorphosis Hour", listeners: 0, live: false, img: trendingSongs[4].img, genre: "Experimental" },
  { id: 3, name: "Merkell", show: "The Refinery Live", listeners: 0, live: false, img: trendingSongs[2].img, genre: "R&B / Soul" },
  { id: 4, name: "PayAuto", show: "Diamond Cuts", listeners: 0, live: false, img: trendingSongs[1].img, genre: "Drill / UK Rap" },
];

export const livePerformances = [
  { id: 1, artist: "CrRon", venue: "The Refinery NYC", date: "Mar 14", time: "9:00 PM", price: 25, img: trendingSongs[0].img, tickets: 48, capacity: 200 },
  { id: 2, artist: "Merkell", venue: "Bedroom Studios LA", date: "Mar 22", time: "8:30 PM", price: 30, img: trendingSongs[2].img, tickets: 112, capacity: 150 },
  { id: 3, artist: "PayAuto", venue: "Frequency Hall ATL", date: "Apr 02", time: "10:00 PM", price: 20, img: trendingSongs[1].img, tickets: 31, capacity: 300 },
  { id: 4, artist: "Tanaka Mak", venue: "Catalyst Lounge LDN", date: "Apr 11", time: "9:00 PM", price: 40, img: trendingSongs[4].img, tickets: 89, capacity: 120 },
];

export const myUploads = [
  { id: 101, title: "Lets Get To It", plays: 3142, ripples: 87, temp: 56, status: "live", uploaded: "2 days ago", img: trendingSongs[0].img },
  { id: 102, title: "Frequency Walk", plays: 1289, ripples: 41, temp: 52, status: "live", uploaded: "1 week ago", img: trendingSongs[3].img },
  { id: 103, title: "Underground 2 AM", plays: 562, ripples: 22, temp: 47, status: "review", uploaded: "yesterday", img: trendingSongs[6].img },
  { id: 104, title: "Cocoon (rough)", plays: 0, ripples: 0, temp: 0, status: "draft", uploaded: "today", img: trendingSongs[7].img },
];

export const analyticsDaily = [
  { d: "Mon", plays: 412, ripples: 38, ears: 142 },
  { d: "Tue", plays: 528, ripples: 51, ears: 187 },
  { d: "Wed", plays: 612, ripples: 62, ears: 198 },
  { d: "Thu", plays: 489, ripples: 44, ears: 161 },
  { d: "Fri", plays: 894, ripples: 91, ears: 287 },
  { d: "Sat", plays: 1241, ripples: 134, ears: 412 },
  { d: "Sun", plays: 1068, ripples: 112, ears: 348 },
];

export const refineryQueue = [
  { id: 201, title: "Bump Ha ft Xim", artist: "Osodrac", img: trendingSongs[10].img, temp: 53 },
  { id: 202, title: "Gold Like Corral", artist: "CrRon", img: trendingSongs[11].img, temp: 52 },
  { id: 203, title: "Remember", artist: "Meequise", img: trendingSongs[6].img, temp: 51 },
];

export const rewards = {
  balance: 248.75,
  pending: 14.20,
  totalEarned: 612.40,
  history: [
    { id: 1, label: "Survey: Avatar by CrRontay", amount: 1.25, when: "Today · 14:02" },
    { id: 2, label: "Refinery rank: 5 songs", amount: 6.50, when: "Today · 10:18" },
    { id: 3, label: "Daily streak bonus · day 12", amount: 3.00, when: "Yesterday" },
    { id: 4, label: "Comment promoted to top", amount: 0.75, when: "Yesterday" },
    { id: 5, label: "Survey: Deez Days by PayAuto", amount: 1.25, when: "2 days ago" },
    { id: 6, label: "Weekly Prospector top 50", amount: 8.00, when: "3 days ago" },
  ],
};

export { trendingSongs, trendingArtists, schedule, platformStats };
