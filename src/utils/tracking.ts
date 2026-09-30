const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'igshid',
  'igsh',
  'si',
  'feature',
  'ref',
  'ref_src',
  'ref_url',
  's',
  't',
  'tt_from',
  'ttclid',
  'share_app_id',
  'share_link_id',
  'share_item_id',
  'is_from_webapp',
  'sender_device',
  'sender_web_id',
  'source',
  'mc_cid',
  'mc_eid',
]);

export function isTrackingParam(name: string): boolean {
  const key = name.trim().toLowerCase();
  if (TRACKING_PARAMS.has(key)) return true;
  return key.startsWith('utm_');
}

export function stripTrackingParams(url: URL): URL {
  const next = new URL(url.href);
  for (const key of [...next.searchParams.keys()]) {
    if (isTrackingParam(key)) {
      next.searchParams.delete(key);
    }
  }
  next.hash = '';
  return next;
}
