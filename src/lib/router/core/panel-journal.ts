// Журнал записей истории для боковой панели: для каждого индекса записи — реальный адрес
// (pathname + search) и значение одной `#key=value` пары. По нему роутер панели решает,
// шаг «назад» — это шаг той же панели или уход с неё. Подписка на адаптер живёт вечно
// и пишет записи, даже пока панель не смонтирована.
import { getHistory } from '../history/registry';
import { parseHashParams } from './hash-params';

export interface JournalEntry { main: string; value: string | undefined }

export interface PanelJournal {
  /** Запись по индексу истории; undefined — не видели (перезагрузка, чужой адаптер). */
  get(position: number): JournalEntry | undefined;
  /** Индекс текущей записи по последнему уведомлению адаптера (−1, если адаптер без position). */
  readonly position: number;
  /** Подписчик на обновления журнала (для $state-зеркала в компоненте); возвращает отписку. */
  subscribe(cb: () => void): () => void;
}

const journals = new Map<string, { journal: PanelJournal; off: () => void }>();

/** Журнал на hashParam: создаётся при первом обращении, подписывается на getHistory().listen
 *  навсегда и сразу записывает текущую запись. Повторный вызов — тот же объект.
 *  Binds to the adapter current at first call; not rebound if setHistoryAdapter swaps it. */
export function ensurePanelJournal(hashParam: string): PanelJournal {
  const existing = journals.get(hashParam);
  if (existing) return existing.journal;

  const history = getHistory();
  const entries = new Map<number, JournalEntry>();
  const subscribers = new Set<() => void>();
  let position = -1;

  const record = () => {
    const at = history.position;
    if (typeof at !== 'number') return;
    const loc = history.location;
    if (!loc) return;
    position = at;
    entries.set(at, { main: loc.pathname + loc.search, value: parseHashParams(loc.hash)[hashParam] });
    subscribers.forEach((cb) => cb());
  };

  const journal: PanelJournal = {
    get: (at) => entries.get(at),
    get position() { return position; },
    subscribe(cb) {
      subscribers.add(cb);
      return () => { subscribers.delete(cb); };
    },
  };
  const off = history.listen(record);
  journals.set(hashParam, { journal, off });
  record();
  return journal;
}

/** Только для тестов: сброс всех журналов и их подписок. */
export function resetPanelJournals(): void {
  journals.forEach(({ off }) => off());
  journals.clear();
}
