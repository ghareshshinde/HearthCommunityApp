const ICONS: Record<string, string> = {
  chess: 'chess', carrom: 'carrom', cricket: 'cricket', badminton: 'badminton',
  'table tennis': 'tabletennis', 'tabletennis': 'tabletennis', pickleball: 'pickleball',
}
/** Icon for a sport name; anything unknown gets the trophy. Files live in public/img. */
export const sportIcon = (name: string) => `/img/${ICONS[name.trim().toLowerCase()] ?? 'trophy'}.svg`

export type EntryKind = 'singles' | 'doubles' | 'team'
const FORMATS: Record<string, EntryKind[]> = {
  badminton: ['singles', 'doubles'], 'table tennis': ['singles', 'doubles'], carrom: ['singles', 'doubles'],
  pickleball: ['singles', 'doubles'], chess: ['singles'], cricket: ['team'],
}
/** Which ways a sport is played at this event. Sports we do not know about allow everything. */
export const sportFormats = (name: string): EntryKind[] => FORMATS[name.trim().toLowerCase()] ?? ['singles', 'doubles', 'team']
/** Usual squad size for team sports, used as the form default. */
export const defaultTeamSize = (name: string) => (name.trim().toLowerCase() === 'cricket' ? 11 : 5)
