const ICONS: Record<string, string> = {
  chess: 'chess', carrom: 'carrom', cricket: 'cricket', badminton: 'badminton',
  'table tennis': 'tabletennis', 'tabletennis': 'tabletennis', pickleball: 'pickleball',
}
/** Icon for a sport name; anything unknown gets the trophy. Files live in public/img. */
export const sportIcon = (name: string) => `/img/${ICONS[name.trim().toLowerCase()] ?? 'trophy'}.svg`
