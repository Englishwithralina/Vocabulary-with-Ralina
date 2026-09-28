// Presentation only. World selection never enters Firestore or the answer engine.
const asset = name => new URL(`./assets/worlds/${name}`, import.meta.url).href;
export const worlds = Object.freeze([
  { id: 'uk', name: 'The United Kingdom', place: 'London', flag: 'gb', description: 'A little London magic.', art: asset('uk.webp'), thumbnail: asset('uk-card.webp'), accent: '#c42369', soft: '#f9e8f1' },
  { id: 'usa', name: 'The USA', place: 'New York', flag: 'us', description: 'Big city. Bright possibilities.', art: asset('usa.webp'), thumbnail: asset('usa-card.webp'), accent: '#166eb4', soft: '#e2f3fb' },
  { id: 'canada', name: 'Canada', place: 'The Canadian Rockies', flag: 'ca', description: 'Find your mountain moment.', art: asset('canada.webp'), thumbnail: asset('canada-card.webp'), accent: '#16775e', soft: '#e3f3eb' },
  { id: 'australia', name: 'Australia', place: 'Sydney', flag: 'au', description: 'A harbour full of possibility.', art: asset('australia.webp'), thumbnail: asset('australia-card.webp'), accent: '#157e96', soft: '#e1f5f4' },
]);
export const getWorld = id => worlds.find(world => world.id === id) || worlds[0];
export function worldStyle(world) {
  return `--world-art:url('${world.art}');--world-accent:${world.accent};--world-soft:${world.soft}`;
}
