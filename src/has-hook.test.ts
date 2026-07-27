import { afterEach, describe, expect, it } from 'vitest';

import { actionsRegistry, addAction, removeAllActions } from './actions';
import { addFilter, filtersRegistry, removeAllFilters } from './filters';
import { hasHook } from './index';

afterEach(() => {
  actionsRegistry.reset();
  filtersRegistry.reset();
});

describe('hasHook', () => {
  it('returns false when nothing is registered', () => {
    expect(hasHook('unregistered')).toBe(false);
  });

  it('returns true when only an action is registered', () => {
    addAction('boot', () => {});
    expect(hasHook('boot')).toBe(true);
  });

  it('returns true when only a filter is registered', () => {
    addFilter('boot', (v: unknown) => v);
    expect(hasHook('boot')).toBe(true);
  });

  it('returns false again after every registration is removed', () => {
    addAction('boot', () => {});
    addFilter('boot', (v: unknown) => v);
    removeAllActions('boot');
    removeAllFilters('boot');
    expect(hasHook('boot')).toBe(false);
  });
});
