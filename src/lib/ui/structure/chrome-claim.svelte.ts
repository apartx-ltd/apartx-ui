import { getContext, hasContext, setContext } from 'svelte';

/**
 * Claim on the host chrome (`setHostChrome`) within one `<Page>`: exactly one kit `<Toolbar>`
 * — the first-ranked — owns it, renders the host's `end` and lets its `<BackButton>` follow
 * `getBackVisibility`. A Toolbar inside `<Header>` (rank 2) takes the claim from a plain one
 * (rank 1) even when it mounts later; ties go to the first mounted. When the owner unmounts it
 * frees the claim and a remaining toolbar re-claims. Overlays and `<Footer>` provide `null`:
 * nothing in their subtree may claim (a nested `<Page>` inherits that).
 */

/** 1 — a plain Toolbar, 2 — a Toolbar inside Header. */
export type ChromeRank = 1 | 2;

export interface ChromeClaim {
  owner: symbol | null;
  rank: ChromeRank | 0;
}

const CHROME_CLAIM_KEY = Symbol('apartx-ui:chrome-claim');

/** Set by `<Header>`: toolbars in its subtree claim with rank 2. */
export const IN_HEADER_KEY: unique symbol = Symbol('apartx-ui:in-header');

/**
 * Set by every `<Toolbar>` as a getter `() => isOwner`; read by `<BackButton>`. Reset to
 * `undefined` by `provideChromeClaim`, so a BackButton in an overlay opened from an owning
 * toolbar doesn't inherit its ownership.
 */
export const HOST_TOOLBAR_KEY: unique symbol = Symbol('apartx-ui:host-toolbar');

export function createChromeClaim(): ChromeClaim {
  const claim = $state<ChromeClaim>({ owner: null, rank: 0 });
  return claim;
}

/** `null` = claiming is impossible in this subtree (overlays, Footer). */
export function provideChromeClaim(claim: ChromeClaim | null): void {
  setContext(CHROME_CLAIM_KEY, claim);
  setContext(HOST_TOOLBAR_KEY, undefined);
}

/** `undefined` = outside any `<Page>`; `null` = inside an overlay/Footer. */
export function getChromeClaim(): ChromeClaim | null | undefined {
  if (!hasContext(CHROME_CLAIM_KEY)) return undefined;
  return getContext<ChromeClaim | null>(CHROME_CLAIM_KEY);
}
