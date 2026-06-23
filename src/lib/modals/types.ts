/** A single modal's registration: how to load its component, and how it behaves. */
export interface ModalEntry {
  /** Lazy loader for the modal component. The bundler splits each into its own chunk. */
  load: () => Promise<{ default: any }>;
  /**
   * When true the chunk is imported at registry-inject time and kept warm, so the
   * very first `open()` paints with no `await import` gap (e.g. the confirm dialog).
   */
  eager?: boolean;
}

/** Host-owned map of modal id → registration. Injected once via `setModalRegistry`. */
export type ModalRegistry = Record<string, ModalEntry>;

/** One open modal instance living in the reactive `stack`. */
export interface OpenInstance {
  /** Monotonic instance id — stack identity / `{#each}` key. */
  key: number;
  /** Registry key (which modal). */
  id: string;
  /** Input props, spread onto the modal component. */
  props: any;
  /** Resolves the Promise returned by `open()`. Called by `closeInstance`. */
  resolve: (result: any) => void;
}
