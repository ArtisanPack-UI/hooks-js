import { act, render, renderHook, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { StrictMode, useEffect, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { actionsRegistry, addAction } from '../actions';
import { deprecateHook, deprecations } from '../deprecations';
import { addFilter, applyFilters, filtersRegistry, removeFilter } from '../filters';

import { HookSlot, useAction, useFilter, useHookedChildren } from './index';

afterEach(() => {
  actionsRegistry.reset();
  filtersRegistry.reset();
  deprecations.reset();
});

describe('useFilter', () => {
  it('returns the raw value when no filters are registered', () => {
    const { result } = renderHook(() => useFilter<string>('title', 'hello'));
    expect(result.current).toBe('hello');
  });

  it('applies registered filters and forwards extra args', () => {
    addFilter('title', (v: string, prefix: string) => `${prefix}${v}`);
    const { result } = renderHook(() => useFilter<string>('title', 'hello', '>>> '));
    expect(result.current).toBe('>>> hello');
  });

  it('re-renders when a filter is added after mount', () => {
    const { result } = renderHook(() => useFilter<string>('title', 'hello'));
    expect(result.current).toBe('hello');

    act(() => {
      addFilter('title', (v: string) => v.toUpperCase());
    });

    expect(result.current).toBe('HELLO');
  });

  it('re-renders when a filter is removed after mount', () => {
    const upper = (v: string): string => v.toUpperCase();
    addFilter('title', upper);
    const { result } = renderHook(() => useFilter<string>('title', 'hello'));
    expect(result.current).toBe('HELLO');

    act(() => {
      removeFilter('title', upper);
    });

    expect(result.current).toBe('hello');
  });

  it('reacts to filter mutations on aliased hook names', () => {
    deprecateHook('old.title', 'title');
    const { result } = renderHook(() => useFilter<string>('title', 'hello'));
    expect(result.current).toBe('hello');

    act(() => {
      // Add under the OLD name after mount — subscription must cover the
      // reverse-alias bucket so the component re-renders.
      addFilter('old.title', (v: string) => v.toUpperCase());
    });

    expect(result.current).toBe('HELLO');
  });
});

describe('useAction', () => {
  it('fires on mount', () => {
    const spy = vi.fn();
    addAction('mounted', spy);
    renderHook(() => useAction('mounted', 1, 2));
    expect(spy).toHaveBeenCalledWith(1, 2);
  });

  it('does not re-fire when args are deep-equal across renders', () => {
    const spy = vi.fn();
    addAction('changed', spy);
    const { rerender } = renderHook(
      ({ args }: { args: unknown[] }) => useAction('changed', ...args),
      {
        initialProps: { args: [{ a: 1 }] },
      },
    );
    expect(spy).toHaveBeenCalledOnce();

    rerender({ args: [{ a: 1 }] }); // new object literal, deep-equal
    expect(spy).toHaveBeenCalledOnce();
  });

  it('re-fires when args deep-change', () => {
    const spy = vi.fn();
    addAction('changed', spy);
    const { rerender } = renderHook(
      ({ args }: { args: unknown[] }) => useAction('changed', ...args),
      {
        initialProps: { args: [{ a: 1 }] },
      },
    );
    expect(spy).toHaveBeenCalledOnce();

    rerender({ args: [{ a: 2 }] });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith({ a: 2 });
  });
});

describe('useHookedChildren', () => {
  function Consumer(): ReactNode {
    return useHookedChildren('wrap.children', <span>plain</span>);
  }

  it('returns children unchanged when no filter is registered', () => {
    render(<Consumer />);
    expect(screen.getByText('plain')).toBeInTheDocument();
  });

  it('re-renders wrapped children when a filter is added post-mount', () => {
    render(<Consumer />);
    expect(screen.queryByTestId('wrapper')).not.toBeInTheDocument();

    act(() => {
      addFilter('wrap.children', (children: ReactNode) => (
        <div data-testid="wrapper">{children}</div>
      ));
    });

    expect(screen.getByTestId('wrapper')).toBeInTheDocument();
    expect(screen.getByText('plain')).toBeInTheDocument();
  });
});

describe('HookSlot', () => {
  it('renders children as fallback when no callback is registered', () => {
    render(
      <HookSlot hook="slot.a" value={<span data-testid="filtered">filtered</span>}>
        <span data-testid="fallback">fallback</span>
      </HookSlot>,
    );

    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('filtered')).not.toBeInTheDocument();
  });

  it('renders the filtered value once a filter is registered', () => {
    render(
      <HookSlot hook="slot.a" value={<span data-testid="filtered">filtered</span>}>
        <span data-testid="fallback">fallback</span>
      </HookSlot>,
    );

    act(() => {
      addFilter('slot.a', (v) => v);
    });

    expect(screen.getByTestId('filtered')).toBeInTheDocument();
    expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
  });

  it('forwards args through the filter', () => {
    addFilter('slot.b', (v: string, suffix: string) => `${v}${suffix}`);
    render(
      <HookSlot hook="slot.b" value="hello" args={['!']}>
        fallback
      </HookSlot>,
    );
    expect(screen.getByText('hello!')).toBeInTheDocument();
  });
});

describe('SSR safety', () => {
  it('renders on the server without touching subscription APIs', () => {
    // No addFilter, no addAction during SSR.
    function App(): ReactNode {
      return (
        <HookSlot hook="ssr.slot" value="filtered">
          fallback
        </HookSlot>
      );
    }
    const html = renderToString(<App />);
    // With no filter registered, HookSlot renders fallback.
    expect(html).toContain('fallback');
    expect(html).not.toContain('filtered');
  });

  it('drops SSR-registered effects and re-attaches on hydrate', () => {
    // Simulate: a component registers a filter in useEffect. On the server
    // this never runs — no filter registered. On the client after mount
    // (hydrate), the effect fires and useFilter picks up the new value.
    const attach = vi.fn((v: string) => v.toUpperCase());
    function Consumer(): ReactNode {
      useEffect(() => {
        addFilter('hydrated.title', attach);
        return () => {
          removeFilter('hydrated.title', attach);
        };
      }, []);
      return <span>{useFilter<string>('hydrated.title', 'hi')}</span>;
    }

    // SSR pass: effects do not run, filter never registered.
    const ssrHtml = renderToString(<Consumer />);
    expect(ssrHtml).toContain('hi');
    expect(ssrHtml).not.toContain('HI');
    expect(attach).not.toHaveBeenCalled();

    // Client mount: effect runs, filter registers, component re-renders.
    const { getByText } = render(
      <StrictMode>
        <Consumer />
      </StrictMode>,
    );
    expect(getByText('HI')).toBeInTheDocument();
  });
});

describe('adapter subscription lifecycle', () => {
  it("removes only the unmounted component's subscribers, not sibling ones", () => {
    // Two consumers on the same hook. When one unmounts, the other must
    // keep re-rendering on filter mutations.
    function Consumer({ id }: { id: string }): ReactNode {
      const value = useFilter<string>('siblings', 'seed');
      return <span data-testid={`c-${id}`}>{value}</span>;
    }

    const { rerender, unmount } = render(
      <>
        <Consumer id="a" />
        <Consumer id="b" />
      </>,
    );

    expect(screen.getByTestId('c-a').textContent).toBe('seed');
    expect(screen.getByTestId('c-b').textContent).toBe('seed');

    // Unmount only one of them by re-rendering without it.
    rerender(<Consumer id="b" />);
    expect(screen.queryByTestId('c-a')).not.toBeInTheDocument();
    expect(screen.getByTestId('c-b')).toBeInTheDocument();

    // Sibling must still react to filter changes.
    act(() => {
      addFilter('siblings', (v: string) => v.toUpperCase());
    });
    expect(screen.getByTestId('c-b').textContent).toBe('SEED');

    unmount();
    // After full unmount, mutating the registry must not throw.
    expect(() => addFilter('siblings', (v: string) => v)).not.toThrow();
  });

  it('StrictMode double-invoke does not register the same effect-attached callback twice', () => {
    // Effects run twice in StrictMode in dev; the cleanup between the two
    // must remove the first registration so we end up with exactly one.
    const filterFn = (v: string): string => `${v}!`;
    function Consumer(): ReactNode {
      useEffect(() => {
        addFilter('strict.title', filterFn);
        return () => {
          removeFilter('strict.title', filterFn);
        };
      }, []);
      return <span>{useFilter<string>('strict.title', 'hi')}</span>;
    }

    render(
      <StrictMode>
        <Consumer />
      </StrictMode>,
    );

    // Rendered value proves the callback is registered exactly once — a
    // duplicate registration would produce 'hi!!'.
    expect(screen.getByText('hi!')).toBeInTheDocument();
    expect(applyFilters<string>('strict.title', 'go')).toBe('go!');
  });

  it('post-mount registration triggers a re-render even under StrictMode', () => {
    function Consumer(): ReactNode {
      return <span>{useFilter<string>('mid.mount', 'lo')}</span>;
    }

    render(
      <StrictMode>
        <Consumer />
      </StrictMode>,
    );
    expect(screen.getByText('lo')).toBeInTheDocument();

    act(() => {
      addFilter('mid.mount', (v: string) => v.toUpperCase());
    });

    expect(screen.getByText('LO')).toBeInTheDocument();
  });
});
