<script lang="ts">
  import { TextField, Select, Checkbox, Switch, FormField, DatePicker } from '$lib/ui/forms';

  let text = $state('');
  let select = $state('');
  let checked = $state(false);
  let on = $state(true);
  let date = $state('');
</script>

<h1 class="text-headline-md mb-6">Forms</h1>

<div class="flex max-w-md flex-col gap-6">
  <TextField bind:value={text} label="Text field" placeholder="Type something…" />

  <Select
    bind:value={select}
    label="Select"
    placeholder="Choose…"
    options={[
      { value: 'a', label: 'Option A' },
      { value: 'b', label: 'Option B' },
      { value: 'c', label: 'Option C' },
    ]}
  />

  <Checkbox bind:checked label="Accept terms" />
  <Switch bind:checked={on} label="Enabled" />

  <DatePicker bind:value={date} label="Date picker" placeholder="Pick a date" />

  <!-- FormField is a form-aware TextField wrapper (same props as TextField). -->
  <FormField label="FormField (TextField wrapper)" placeholder="Wrapped field" />

  <p class="text-body-sm text-on-surface-variant">
    text=<code>{text}</code> · select=<code>{select}</code> ·
    checked=<code>{checked}</code> · on=<code>{on}</code> · date=<code>{date}</code>
  </p>
</div>
