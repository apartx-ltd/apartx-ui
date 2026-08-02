<script lang="ts">
  import { Text, TEXT_ROLES, TEXT_TONES } from '$lib/ui/display';
</script>

<h1 class="text-headline-md mb-6">Typography</h1>

<section class="mb-8">
  <h2 class="text-title-md mb-3">Roles — компонент</h2>
  <div class="flex flex-col gap-2">
    {#each TEXT_ROLES as role (role)}
      <div class="flex items-baseline gap-4">
        <code class="text-label-md text-on-surface-variant w-36 shrink-0">{role}</code>
        <Text {role}>Съешь ещё этих мягких булок — 1234567890</Text>
      </div>
    {/each}
  </div>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">Tones (на роли body)</h2>
  <div class="flex flex-col gap-1">
    {#each TEXT_TONES as tone (tone)}
      <div class="flex items-baseline gap-4">
        <code class="text-label-md text-on-surface-variant w-36 shrink-0">{tone}</code>
        <Text role="body" {tone}>Оплата прошла успешно</Text>
      </div>
    {/each}
  </div>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">tone="inherit" на цветной подложке</h2>
  <div class="rounded-md bg-error-container p-3 text-on-error-container">
    <Text role="item-title" tone="inherit">Оплата не прошла</Text>
    <Text role="caption" tone="inherit">Проверьте карту и попробуйте снова</Text>
  </div>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">Utility-алиасы (без компонента)</h2>
  <p class="text-hint">class="text-hint" — body-md, on-surface-variant</p>
  <p class="text-hint text-error">class="text-hint text-error" — тон перебит утилитой</p>
  <span class="text-overline">class="text-overline"</span>
</section>
