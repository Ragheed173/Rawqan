import { describe, expect, it } from 'vitest';

import { shouldAutoActivateServiceWorker } from './registerSW';

describe('shouldAutoActivateServiceWorker', () => {
  it('keeps updates manual throughout the POS', () => {
    expect(shouldAutoActivateServiceWorker('/pos')).toBe(false);
    expect(shouldAutoActivateServiceWorker('/pos/table/1')).toBe(false);
    expect(shouldAutoActivateServiceWorker('/pos/diagnostics')).toBe(false);
  });

  it('activates updates automatically on public and admin pages', () => {
    expect(shouldAutoActivateServiceWorker('/')).toBe(true);
    expect(shouldAutoActivateServiceWorker('/menu')).toBe(true);
    expect(shouldAutoActivateServiceWorker('/admin/pos')).toBe(true);
  });
});
