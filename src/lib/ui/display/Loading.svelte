<script>
  import { cn } from '../utils/cn';

  /**
   * Spinner.
   *
   * @param size - sm | md
   *   `md` (default) — block loader for a screen or a section: takes the free space of a
   *   flex parent and carries its own padding.
   *   `sm` — inline loader: no padding, no `flex-1`, fits a list row, a toolbar or a button.
   *
   * До 0.9.11 `size` был фантомным пропом: компонент его не объявлял, значение молча
   * оседало HTML-атрибутом на обёртке, и `size="sm"` рисовался как блок 96px высотой.
   * Вызовы с `size="sm"` в потребителях писались в расчёте на строчный спиннер — теперь
   * они его и получают.
   */
  let { size = 'md', class: className, ...restProps } = $props();

  const wrappers = {
    sm: 'inline-flex items-center justify-center',
    md: 'flex items-center justify-center flex-1 p-8',
  };

  const spinners = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
  };
</script>

<div class={cn(wrappers[size] ?? wrappers.md, className)} {...restProps}>
  <svg
    class={cn('animate-spin text-primary', spinners[size] ?? spinners.md)}
    viewBox="0 0 24 24"
    fill="none"
  >
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
  </svg>
</div>
