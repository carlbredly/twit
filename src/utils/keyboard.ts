export function isSearchHotkey(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey?: boolean;
  repeat?: boolean;
}): boolean {
  if (event.repeat) return false;
  if (event.altKey) return false;
  return event.key === 'Enter' && (event.ctrlKey || event.metaKey);
}

export function isCancelHotkey(event: { key: string }): boolean {
  return event.key === 'Escape';
}
