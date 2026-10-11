/** Опция `Select`/`Combobox`. Хост расширяет её своими полями (`T extends Option`) — они видны сниппетам. */
export type Option = {
  value: string;
  label: string;
  disabled?: boolean;
  /** Заголовок серии. Соседние опции с одинаковым `group` рисуются под одним заголовком. */
  group?: string;
};

export type OptionGroup<T extends Option = Option> = { label: string | undefined; options: T[] };

/**
 * Режет список на серии соседних опций с одинаковым `group`, порядок сохраняется. Одинаковый
 * `group` в разных местах списка — разные серии (это сознательно: «сохранённые» между
 * встроенными и «прочее» — три серии, две линии). Серия без `group` рендерится без заголовка.
 */
export function groupOptions<T extends Option>(options: T[]): OptionGroup<T>[] {
  const out: OptionGroup<T>[] = [];
  for (const opt of options) {
    const last = out[out.length - 1];
    if (last && last.label === opt.group) {
      last.options.push(opt);
      continue;
    }
    out.push({ label: opt.group, options: [opt] });
  }
  return out;
}
