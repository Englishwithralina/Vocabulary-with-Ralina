const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  library: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  folder: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  backup: '<path d="M7 17H6a4 4 0 0 1-1-8 7 7 0 0 1 13-2 5 5 0 0 1 0 10h-1M12 21V10m-4 4 4-4 4 4"/>',
  book: '<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15"/>',
  edit: '<path d="m14 5 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15Z"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  share: '<circle cx="18" cy="4" r="3"/><circle cx="5" cy="12" r="3"/><circle cx="18" cy="20" r="3"/><path d="m8 10 7-4M8 14l7 4"/>',
  globe: '<circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><path d="M2 12h20M4 6h16M4 18h16"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  chart: '<path d="M5 20v-6M12 20V9M19 20V3"/>',
  trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v2a5 5 0 0 0 5 5m9-7h4v2a5 5 0 0 1-5 5M12 14v5m-5 2h10m-7-2h4"/>',
  logout: '<path d="M10 3H4v18h6m5-15 6 6-6 6M9 12h12"/>',
  refresh: '<path d="M20 8a9 9 0 1 0 1 7M20 2v6h-6"/>',
};
export const icon = (name, className = '') => `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;

// Vector flags stay sharp at small sizes and have no platform-dependent emoji rendering.
export function flag(code) {
  const union = '<path fill="#173471" d="M0 0h60v36H0z"/><path stroke="#fff" stroke-width="9" d="m0 0 60 36M60 0 0 36"/><path stroke="#ce2441" stroke-width="4" d="m0 0 60 36M60 0 0 36"/><path stroke="#fff" stroke-width="13" d="M30 0v36M0 18h60"/><path stroke="#ce2441" stroke-width="7" d="M30 0v36M0 18h60"/>';
  let content = union;
  if (code === 'us') content = `<path fill="#fff" d="M0 0h60v36H0z"/>${Array.from({ length: 7 }, (_, i) => `<path fill="#c92e43" d="M0 ${i * 5.54}h60v2.77H0z"/>`).join('')}<path fill="#183c78" d="M0 0h27v19.4H0z"/>${Array.from({ length: 9 }, (_, row) => Array.from({ length: row % 2 ? 5 : 6 }, (_, col) => `<circle cx="${2.5 + col * 4.4 + (row % 2 ? 2.2 : 0)}" cy="${1.8 + row * 1.95}" r=".7" fill="white"/>`).join('')).join('')}`;
  if (code === 'ca') content = '<path fill="#fff" d="M0 0h60v36H0z"/><path fill="#cf2940" d="M0 0h13v36H0zM47 0h13v36H47zM30 5l3 6 4-2-1 7 6-2-2 5 3 2-10 5 1 4-3-1v5h-2v-5l-3 1 1-4-10-5 3-2-2-5 6 2-1-7 4 2Z"/>';
  if (code === 'au') content = `<path fill="#163774" d="M0 0h60v36H0z"/><g transform="scale(.5)">${union}</g><g fill="white"><path d="m16 21 1 4 4-1-2 3 3 3-4-1-2 4-1-4-4 1 3-3-2-3 4 1Z"/><path d="m46 5 1 3 3 1-3 1-1 3-1-3-3-1 3-1Zm-8 10 1 2 2 1-2 1-1 2-1-2-2-1 2-1Zm15-2 1 2 2 1-2 1-1 2-1-2-2-1 2-1Zm-7 12 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"/><circle cx="48" cy="21" r="1"/></g>`;
  return `<svg class="flag" viewBox="0 0 60 36" aria-hidden="true">${content}</svg>`;
}

