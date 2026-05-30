<script>
  import { cn } from '../utils/cn';
  import Loading from '../display/Loading.svelte';

  /**
   * Data table.
   *
   * @param columns - Array of { key, header, class? }
   * @param data - Array of row objects
   * @param loading - Show loading state
   * @param onRowClick - Row click handler (receives row data)
   * @param stickyHeader - Sticky table header
   */
  let {
    columns = [],
    data = [],
    loading = false,
    onRowClick,
    stickyHeader = true,
    class: className,
    ...restProps
  } = $props();
</script>

<div class={cn('overflow-auto', className)} {...restProps}>
  <table class="w-full border-collapse text-body-md text-on-surface">
    <thead>
      <tr>
        {#each columns as col (col.key)}
          <th
            class={cn(
              'px-4 py-3 text-left text-label-lg text-on-surface-variant font-medium border-b border-outline-variant whitespace-nowrap',
              stickyHeader && 'sticky top-0 bg-surface z-1',
              col.class
            )}
          >
            {#if typeof col.header === 'function'}
              {@render col.header()}
            {:else}
              {col.header ?? col.key}
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#if loading && data.length === 0}
        <tr>
          <td colspan={columns.length} class="px-4 py-8 text-center text-on-surface-variant">
            <Loading class="p-0!" />
          </td>
        </tr>
      {:else if data.length === 0}
        <tr>
          <td colspan={columns.length} class="px-4 py-8 text-center text-on-surface-variant">
            No data
          </td>
        </tr>
      {:else}
        {#each data as row, index (row._id ?? row.id ?? index)}
          <tr
            class={cn(
              'border-b border-outline-variant last:border-b-0',
              onRowClick && 'hover:bg-on-surface/8 cursor-pointer'
            )}
            onclick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {#each columns as col (col.key)}
              <td class={cn('px-4 py-3', col.class)}>
                {#if col.render}
                  {@render col.render(row, index)}
                {:else}
                  {row[col.key] ?? ''}
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>
