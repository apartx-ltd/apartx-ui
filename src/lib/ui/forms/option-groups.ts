/** Опция `Select`/`Combobox`. Лишние поля разрешены — хост кладёт сюда свои данные для сниппетов. */
export type Option = {
  value: string;
  label: string;
  disabled?: boolean;
  /** Заголовок серии. Соседние опции с одинаковым `group` рисуются под одним заголовком. */
  group?: string;
  [key: string]: unknown;
};

export type OptionGroup = { label: string | undefined; options: Option[] };

/**
 * Режет список на серии соседних опций с одинаковым `group`, порядок сохраняется. Одинаковый
 * `group` в разных местах списка — разные серии (это сознательно: «сохранённые» между
 * встроенными и «прочее» — три серии, две линии). Серия без `group` рендерится без заголовка.
 */
export function groupOptions(options: Option[]): OptionGroup[] {
  const out: OptionGroup[] = [];
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
