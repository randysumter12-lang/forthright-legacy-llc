import { describe, expect, it } from 'vitest';
import { deriveProxyBase } from '@/lib/host-proxy';

// Locks host→proxy-base resolution for the runtime-resolved checkout / email
// proxy target. Every canonicalized domain collapses to the Polsia PLATFORM
// payment proxy root (https://polsia.com) — never the customer's own domain,
// which would be a self-loop.

const PLATFORM_PROXY_BASE = 'https://polsia.com';

describe('deriveProxyBase', () => {
  it('maps rigelcontracts.co to the platform proxy base', () => {
    expect(deriveProxyBase('rigelcontracts.co')).toBe(PLATFORM_PROXY_BASE);
  });

  it('maps www.rigelcontracts.co to the platform proxy base', () => {
    expect(deriveProxyBase('www.rigelcontracts.co')).toBe(PLATFORM_PROXY_BASE);
  });

  it('maps rigel-solutions.polsia.io to the platform proxy base', () => {
    expect(deriveProxyBase('rigel-solutions.polsia.io')).toBe(PLATFORM_PROXY_BASE);
  });

  it('maps www.rigel-solutions.polsia.io to the platform proxy base', () => {
    expect(deriveProxyBase('www.rigel-solutions.polsia.io')).toBe(PLATFORM_PROXY_BASE);
  });

  it('maps rigel-solutions.polsia.io to the platform proxy base', () => {
    expect(deriveProxyBase('rigel-solutions.polsia.io')).toBe(PLATFORM_PROXY_BASE);
  });

  it('maps www.rigel-solutions.polsia.io to the platform proxy base', () => {
    expect(deriveProxyBase('www.rigel-solutions.polsia.io')).toBe(PLATFORM_PROXY_BASE);
  });

  it('falls back to the platform proxy base for an unknown host', () => {
    expect(deriveProxyBase('something-else.example')).toBe(PLATFORM_PROXY_BASE);
  });

  it('falls back to the platform proxy base for an empty host', () => {
    expect(deriveProxyBase('')).toBe(PLATFORM_PROXY_BASE);
  });

  it('lowercases the incoming host before lookup', () => {
    expect(deriveProxyBase('RIGELCONTRACTS.CO')).toBe(PLATFORM_PROXY_BASE);
  });

  it('documents the .io production deployment explicitly', () => {
    expect(deriveProxyBase('rigel-solutions.polsia.io')).toBe(PLATFORM_PROXY_BASE);
  });

  // Lock-in regression: prior attempts collapsed every host to the customer's
  // own apex (https://rigelcontracts.co), which is a self-loop that breaks
  // checkout. This asserts NO input maps back to the customer domain.
  it('never returns the customer apex for any input', () => {
    const inputs = [
      'rigelcontracts.co',
      'www.rigelcontracts.co',
      'rigel-solutions.polsia.io',
      'www.rigel-solutions.polsia.io',
      'rigel-solutions.polsia.io',
      'www.rigel-solutions.polsia.io',
      '',
      'unknown.example',
      'RIGELCONTRACTS.CO',
    ];
    for (const input of inputs) {
      const result = deriveProxyBase(input);
      expect(result).not.toBe('https://rigelcontracts.co');
      expect(result).not.toBe('https://www.rigelcontracts.co');
    }
  });
});
