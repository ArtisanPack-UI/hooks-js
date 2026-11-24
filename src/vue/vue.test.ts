import { fireEvent, render, screen } from '@testing-library/vue';
import {
  createSSRApp,
  defineComponent,
  effectScope,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  type PropType,
} from 'vue';
import { renderToString } from 'vue/server-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { actionsRegistry, addAction, removeAction } from '../actions';
import { deprecateHook, deprecations } from '../deprecations';
import { addFilter, filtersRegistry, removeFilter } from '../filters';

import { HookSlot, VERSION, useAction, useFilter, useHookedChildren } from './index';

afterEach(() => {
  vi.restoreAllMocks();
  actionsRegistry.reset();
  filtersRegistry.reset();
  deprecations.reset();
});

/** Renders `useFilter`'s output in a span. */
function filterProbe(hook: string, value: unknown, ...args: unknown[]) {
  return defineComponent({
    setup() {
      const filtered = useFilter(hook, value, ...args);
      return () => h('span', { 'data-testid': 'out' }, String(filtered.value));
    },
  });
}

const out = (): string => screen.getByTestId('out').textContent ?? '';

describe('vue entry', () => {
  it('re-exports VERSION', () => {
    expect(typeof VERSION).toBe('string');
  });
});

describe('useFilter', () => {
  it('returns the raw value when no filters are registered', () => {
    render(filterProbe('title', 'hello'));
    expect(out()).toBe('hello');
  });

  it('applies registered filters and forwards extra args', () => {
    addFilter('title', (v: string, prefix: string) => `${prefix}${v}`);
    render(filterProbe('title', 'hello', '>>> '));
    expect(out()).toBe('>>> hello');
  });

  it('updates when a filter is added after mount', async () => {
    render(filterProbe('title', 'hello'));
    expect(out()).toBe('hello');

    addFilter('title', (v: string) => v.toUpperCase());
    await nextTick();

    expect(out()).toBe('HELLO');
  });

  it('updates when a filter is removed after mount', async () => {
    const upper = (v: string): string => v.toUpperCase();
    addFilter('title', upper);
    render(filterProbe('title', 'hello'));
    expect(out()).toBe('HELLO');

    removeFilter('title', upper);
    await nextTick();

    expect(out()).toBe('hello');
  });

  it('reacts to filter mutations on aliased hook names', async () => {
    deprecateHook('old.title', 'title');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(filterProbe('title', 'hello'));
    expect(out()).toBe('hello');

    addFilter('old.title', (v: string) => `${v}!`);
    await nextTick();

    expect(out()).toBe('hello!');
  });

  it('recomputes when the value, an arg or the hook name ref changes', async () => {
    addFilter('a', (v: string, suffix: string) => `a:${v}${suffix}`);
    addFilter('b', (v: string) => `b:${v}`);
    const hook = ref('a');
    const value = ref('x');
    const suffix = ref('?');
    const Probe = defineComponent({
      setup() {
        const filtered = useFilter<string>(() => hook.value, value, suffix);
        return () => h('span', { 'data-testid': 'out' }, filtered.value);
      },
    });
    render(Probe);
    expect(out()).toBe('a:x?');

    value.value = 'y';
    await nextTick();
    expect(out()).toBe('a:y?');

    suffix.value = '!';
    await nextTick();
    expect(out()).toBe('a:y!');

    hook.value = 'b';
    await nextTick();
    expect(out()).toBe('b:y');

    addFilter('b', (v: string) => `${v}+`);
    await nextTick();
    expect(out()).toBe('b:y+');
  });

  it('passes function args to the filters without calling them', () => {
    const format = vi.fn((v: string) => `[${v}]`);
    addFilter('fmt', (v: string, fn: (s: string) => string) => fn(v));
    render(filterProbe('fmt', 'x', format));
    expect(out()).toBe('[x]');
    expect(format).toHaveBeenCalledTimes(1);
  });

  it('subscribes inside a bare effect scope and stops when the scope stops', () => {
    const scope = effectScope();
    const filtered = scope.run(() => useFilter<string>('scoped', 'v'))!;
    expect(filtered.value).toBe('v');

    addFilter('scoped', (v: string) => v.toUpperCase());
    expect(filtered.value).toBe('V');

    scope.stop();
    expect(() => addFilter('scoped', (v: string) => v)).not.toThrow();
  });

  it('works outside any scope, reflecting the registries when first read', () => {
    addFilter('loose', (v: string) => `${v}!`);
    expect(useFilter<string>('loose', 'v').value).toBe('v!');
  });
});

describe('useAction', () => {
  it('fires on mount', () => {
    const spy = vi.fn();
    addAction('mounted', spy);
    render(
      defineComponent({
        setup() {
          useAction('mounted', 1, 'two');
          return () => null;
        },
      }),
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(1, 'two');
  });

  it('does not re-fire when args are deep-equal, and re-fires when they deep-change', async () => {
    const spy = vi.fn();
    addAction('changed', spy);
    const payload = ref<{ id: number; tags: string[] }>({ id: 1, tags: ['a'] });
    render(
      defineComponent({
        setup() {
          useAction('changed', payload);
          return () => null;
        },
      }),
    );
    expect(spy).toHaveBeenCalledTimes(1);

    payload.value = { id: 1, tags: ['a'] };
    await nextTick();
    expect(spy).toHaveBeenCalledTimes(1);

    payload.value = { id: 2, tags: ['a'] };
    await nextTick();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith({ id: 2, tags: ['a'] });
  });

  it('re-fires under the new name when the hook ref changes', async () => {
    const first = vi.fn();
    const second = vi.fn();
    addAction('first', first);
    addAction('second', second);
    const hook = ref('first');
    render(
      defineComponent({
        setup() {
          useAction(() => hook.value, 'arg');
          return () => null;
        },
      }),
    );
    hook.value = 'second';
    await nextTick();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith('arg');
  });

  it('fires at once inside a bare effect scope', () => {
    const spy = vi.fn();
    addAction('scoped.action', spy);
    const scope = effectScope();
    scope.run(() => useAction('scoped.action'));
    expect(spy).toHaveBeenCalledTimes(1);
    scope.stop();
  });
});

describe('useHookedChildren', () => {
  const Wrapper = defineComponent({
    props: { hook: { type: String, required: true } },
    setup(props, { slots }) {
      const children = useHookedChildren(props.hook, () => slots.default?.(), { where: 'test' });
      return () => h('div', { 'data-testid': 'wrap' }, children.value as never);
    },
  });

  it('returns children unchanged when no filter is registered', () => {
    render(Wrapper, { props: { hook: 'wrap' }, slots: { default: () => h('em', 'inner') } });
    expect(screen.getByTestId('wrap').innerHTML).toBe('<em>inner</em>');
  });

  it('updates wrapped children when a filter is added after mount, passing ctx', async () => {
    const ctxSeen = vi.fn();
    render(Wrapper, { props: { hook: 'wrap' }, slots: { default: () => h('em', 'inner') } });

    addFilter('wrap', (children: unknown, ctx: unknown) => {
      ctxSeen(ctx);
      return h('strong', [children as never]);
    });
    await nextTick();

    expect(screen.getByTestId('wrap').innerHTML).toBe('<strong><em>inner</em></strong>');
    expect(ctxSeen).toHaveBeenCalledWith({ where: 'test' });
  });
});

describe('useHookedChildren with reactive children', () => {
  it('follows a getter for the children', async () => {
    const label = ref('one');
    const Probe = defineComponent({
      setup() {
        const children = useHookedChildren('labels', () => h('em', label.value));
        return () => h('div', { 'data-testid': 'wrap' }, [children.value as never]);
      },
    });
    render(Probe);
    expect(screen.getByTestId('wrap').innerHTML).toBe('<em>one</em>');

    label.value = 'two';
    await nextTick();
    expect(screen.getByTestId('wrap').innerHTML).toBe('<em>two</em>');
  });
});

describe('useAction outside a scope', () => {
  it('fires once without watching', () => {
    const spy = vi.fn();
    addAction('loose.action', spy);
    const payload = ref(1);
    useAction('loose.action', payload);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('HookSlot', () => {
  const slot = (props: { hook: string; value?: unknown; args?: unknown[] }) =>
    render(HookSlot, { props, slots: { default: () => 'fallback' } });

  it('renders the default slot as fallback when no callback is registered', () => {
    const { container } = slot({ hook: 'slot', value: 'filtered' });
    expect(container.textContent).toBe('fallback');
  });

  it('renders the filtered value once a filter is registered', async () => {
    const { container } = slot({ hook: 'slot', value: 'seed' });
    addFilter('slot', (v: string) => v.toUpperCase());
    await nextTick();
    expect(container.textContent).toBe('SEED');
  });

  it('forwards args through the filter', () => {
    addFilter('slot', (v: string, a: string, b: string) => `${v}-${a}-${b}`);
    const { container } = slot({ hook: 'slot', value: 'v', args: ['x', 'y'] });
    expect(container.textContent).toBe('v-x-y');
  });

  it('swaps to the value when an action is added and back when it is removed', async () => {
    const watcher = (): void => undefined;
    const { container } = slot({ hook: 'slot', value: 'observed' });
    expect(container.textContent).toBe('fallback');

    addAction('slot', watcher);
    await nextTick();
    expect(container.textContent).toBe('observed');

    removeAction('slot', watcher);
    await nextTick();
    expect(container.textContent).toBe('fallback');
  });

  it('renders nothing without a default slot or callbacks', () => {
    const { container } = render(HookSlot, { props: { hook: 'empty', value: 'v' } });
    expect(container.textContent).toBe('');
  });
});

describe('SSR safety', () => {
  it('renders on the server without subscribing', async () => {
    const filterSubscribe = vi.spyOn(filtersRegistry, 'subscribe');
    const actionSubscribe = vi.spyOn(actionsRegistry, 'subscribe');
    const app = createSSRApp({
      render: () => h(HookSlot, { hook: 'ssr.slot', value: 'filtered' }, () => 'fallback'),
    });
    const html = await renderToString(app);
    expect(html).toContain('fallback');
    expect(html).not.toContain('filtered');
    expect(filterSubscribe).not.toHaveBeenCalled();
    expect(actionSubscribe).not.toHaveBeenCalled();
  });

  it('does not fire actions on the server, and picks up mount-time filters on the client', async () => {
    const action = vi.fn();
    addAction('ssr.action', action);
    const attach = (v: string): string => v.toUpperCase();
    const Consumer = defineComponent({
      setup() {
        useAction('ssr.action');
        onMounted(() => addFilter('hydrated.title', attach));
        onUnmounted(() => removeFilter('hydrated.title', attach));
        const title = useFilter<string>('hydrated.title', 'hi');
        return () => h('span', title.value);
      },
    });

    const html = await renderToString(createSSRApp(Consumer));
    expect(html).toContain('hi');
    expect(action).not.toHaveBeenCalled();

    render(Consumer);
    await nextTick();
    expect(screen.getByText('HI')).toBeTruthy();
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe('adapter subscription lifecycle', () => {
  it("removes only the unmounted component's subscribers, not sibling ones", async () => {
    const Consumer = defineComponent({
      props: { id: { type: String as PropType<string>, required: true } },
      setup(props) {
        const value = useFilter<string>('siblings', 'seed');
        return () => h('span', { 'data-testid': `c-${props.id}` }, value.value);
      },
    });
    const showA = ref(true);
    const Parent = defineComponent({
      setup() {
        return () => [
          showA.value ? h(Consumer, { id: 'a' }) : null,
          h(Consumer, { id: 'b' }),
          h('button', { onClick: () => (showA.value = false) }, 'hide'),
        ];
      },
    });
    const { unmount } = render(Parent);

    await fireEvent.click(screen.getByText('hide'));
    expect(screen.queryByTestId('c-a')).toBeNull();

    addFilter('siblings', (v: string) => v.toUpperCase());
    await nextTick();
    expect(screen.getByTestId('c-b').textContent).toBe('SEED');

    unmount();
    expect(() => addFilter('siblings', (v: string) => v)).not.toThrow();
  });

  it('unsubscribes every listener on unmount and when the hook name changes', async () => {
    const unsubscribes: ReturnType<typeof vi.fn>[] = [];
    const original = filtersRegistry.subscribe.bind(filtersRegistry);
    vi.spyOn(filtersRegistry, 'subscribe').mockImplementation((hook, listener) => {
      const unsub = vi.fn(original(hook, listener));
      unsubscribes.push(unsub);
      return unsub;
    });
    const hook = ref('first');
    const Probe = defineComponent({
      setup() {
        const value = useFilter<string>(() => hook.value, 'v');
        return () => h('span', value.value);
      },
    });
    const { unmount } = render(Probe);
    expect(unsubscribes).toHaveLength(1);

    hook.value = 'second';
    await nextTick();
    expect(unsubscribes).toHaveLength(2);
    expect(unsubscribes[0]).toHaveBeenCalledTimes(1);

    unmount();
    expect(unsubscribes[1]).toHaveBeenCalledTimes(1);
  });
});
