import {
  computed,
  defineComponent,
  getCurrentInstance,
  getCurrentScope,
  onMounted,
  onScopeDispose,
  shallowRef,
  toValue,
  unref,
  watch,
  type ComputedRef,
  type MaybeRef,
  type MaybeRefOrGetter,
  type PropType,
  type Ref,
  type VNodeChild,
} from 'vue';

import { actionsRegistry, doAction } from '../actions';
import { deprecations } from '../deprecations';
import { applyFilters, filtersRegistry } from '../filters';
import type { HookRegistry } from '../registry';
import { deepEqual } from '../react/deep-equal';

export { VERSION } from '../index';

/**
 * Every hook name that dispatches under `hook` — canonical plus any
 * reverse-index aliases when deprecations are in play. Callers use it to
 * subscribe to every bucket a mutation could land in.
 */
function unionNames(hook: string): readonly string[] {
  const canonical = deprecations.resolveSilent(hook);
  if (!deprecations.hasAliases()) return [canonical];
  const aliases = deprecations.aliasesFor(canonical);
  if (aliases.length === 0) return [canonical];
  return [canonical, ...aliases];
}

/**
 * A counter that bumps whenever a callback is added or removed under `hook`
 * (or any of its aliases) in any of `registries`. Reading it inside a
 * `computed` ties that computed to the registries.
 *
 * Inside a component it subscribes on mount, so server rendering never
 * subscribes (and never leaks a listener); mounting bumps the counter once to
 * pick up registrations made between setup and mount. Inside a bare effect
 * scope it subscribes at once. Either way the subscription ends with the
 * scope. Outside any scope there is nothing to clean up with, so it doesn't
 * subscribe and the value only reflects the registries when first read.
 */
function useRegistryVersion(
  registries: readonly Pick<HookRegistry, 'subscribe'>[],
  hook: MaybeRefOrGetter<string>,
): Readonly<Ref<number>> {
  const version = shallowRef(0);
  let unsubscribe: (() => void) | null = null;

  const attach = (): void => {
    watch(
      () => toValue(hook),
      (name) => {
        unsubscribe?.();
        const names = unionNames(name);
        const unsubs = registries.flatMap((registry) =>
          names.map((n) => registry.subscribe(n, () => version.value++)),
        );
        unsubscribe = () => {
          for (const unsub of unsubs) unsub();
        };
        version.value++;
      },
      { immediate: true },
    );
  };

  if (getCurrentScope() === undefined) return version;

  onScopeDispose(() => {
    unsubscribe?.();
    unsubscribe = null;
  });

  if (getCurrentInstance()) {
    onMounted(attach);
  } else {
    attach();
  }

  return version;
}

/**
 * Read a filter's current output as a computed ref. It recomputes when any
 * callback is added or removed under `hook` (or any of its aliases), and when
 * `hook`, `value` or a ref in `args` changes.
 *
 * `value` and `args` are unwrapped with `unref`: pass a ref or computed for a
 * reactive value. A plain function is passed to the filters as it is, not
 * called, since filters can take callbacks.
 */
export function useFilter<T>(
  hook: MaybeRefOrGetter<string>,
  value: MaybeRef<T>,
  ...args: MaybeRef<unknown>[]
): ComputedRef<T> {
  const version = useRegistryVersion([filtersRegistry], hook);
  return computed(() => {
    void version.value;
    return applyFilters<T>(toValue(hook), unref(value), ...args.map((arg) => unref(arg)));
  });
}

/**
 * Fire `doAction(hook, ...args)` on mount and every time `hook` or `args`
 * deep-change. Deep-equality avoids re-firing on freshly-allocated but
 * semantically-equal args. Depth is capped (see `deepEqual`); cyclic or very
 * deep args are treated as changed and cause the action to re-fire.
 *
 * Inside a component nothing fires during server rendering, as with React's
 * `useAction`. Inside a bare effect scope it fires at once. Outside any scope
 * it fires once and doesn't watch, since nothing could stop the watcher.
 * `args` are unwrapped with `unref`, so pass refs for values that change.
 */
export function useAction(hook: MaybeRefOrGetter<string>, ...args: MaybeRef<unknown>[]): void {
  let last: { hook: string; args: unknown[] } | null = null;

  const fire = (): void => {
    const name = toValue(hook);
    const values = args.map((arg) => unref(arg));
    if (last !== null && last.hook === name && deepEqual(last.args, values)) return;
    last = { hook: name, args: values };
    doAction(name, ...values);
  };

  const start = (): void => {
    fire();
    watch(() => [toValue(hook), ...args.map((arg) => unref(arg))], fire, { deep: true });
  };

  if (getCurrentScope() === undefined) {
    fire();
  } else if (getCurrentInstance()) {
    onMounted(start);
  } else {
    start();
  }
}

/**
 * Filter slot or VNode content through `hook`. Thin wrapper over `useFilter`
 * typed for the wrap-children pattern; `ctx` is passed to the filters as the
 * second argument.
 *
 * `children` can be a getter, such as `() => slots.default?.()`, so the
 * filtered content follows the slot: VNode content is never a function, so
 * unlike `useFilter`'s value there's no callback to mistake for a getter.
 */
export function useHookedChildren(
  hook: MaybeRefOrGetter<string>,
  children: MaybeRefOrGetter<VNodeChild>,
  ctx?: MaybeRef<unknown>,
): ComputedRef<VNodeChild> {
  return useFilter<VNodeChild>(
    hook,
    computed(() => toValue(children)),
    ctx,
  );
}

/** Props for the {@link HookSlot} component. */
export interface HookSlotProps {
  hook: string;
  value?: unknown;
  args?: readonly unknown[];
}

/**
 * Declarative slot: renders the filtered `value` when any callback is
 * registered under `hook`, otherwise falls back to the default slot.
 *
 * "Registered" means action OR filter — a component can supply a placeholder
 * that plugins can either replace outright (filter) or leave visible while
 * still observing (action). It re-renders when either kind is added or
 * removed.
 *
 * ```vue
 * <HookSlot hook="shop.cart.banner" :value="null">
 *   <p>Free shipping over $50.</p>
 * </HookSlot>
 * ```
 */
export const HookSlot = defineComponent({
  name: 'HookSlot',
  props: {
    hook: { type: String, required: true },
    value: { type: null as unknown as PropType<unknown>, required: false },
    args: { type: Array as PropType<readonly unknown[]>, default: () => [] },
  },
  setup(props, { slots }) {
    const version = useRegistryVersion([filtersRegistry, actionsRegistry], () => props.hook);
    const filtered = computed(() => {
      void version.value;
      return applyFilters<unknown>(props.hook, props.value, ...props.args);
    });
    const hasAny = computed(() => {
      void version.value;
      return unionNames(props.hook).some(
        (name) => filtersRegistry.has(name) || actionsRegistry.has(name),
      );
    });
    return () => (hasAny.value ? (filtered.value as VNodeChild) : (slots.default?.() ?? null));
  },
});
