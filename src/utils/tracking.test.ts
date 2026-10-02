import { describe, expect, it } from 'vitest';
import { isTrackingParam, stripTrackingParams } from './tracking';

describe('tracking', () => {
  it('reconnaît les paramètres UTM et clics', () => {
    expect(isTrackingParam('utm_source')).toBe(true);
    expect(isTrackingParam('fbclid')).toBe(true);
    expect(isTrackingParam('igshid')).toBe(true);
    expect(isTrackingParam('id')).toBe(false);
  });

  it('retire le tracking sans toucher aux autres params', () => {
    const cleaned = stripTrackingParams(
      new URL('https://x.com/u/status/1?s=20&utm_source=share&foo=keep')
    );
    expect(cleaned.searchParams.get('foo')).toBe('keep');
    expect(cleaned.searchParams.has('s')).toBe(false);
    expect(cleaned.searchParams.has('utm_source')).toBe(false);
  });
});
