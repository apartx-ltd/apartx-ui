<script lang="ts">
  import {
    TextField, Select, Checkbox, Switch, FormField, DatePicker,
    Label, FormSelect, FormCheckbox, FormDatePicker,
    RadioGroup, Combobox, PhoneInput, DateRangePicker,
  } from '$lib/ui/forms';

  let text = $state('');
  let select = $state('');
  let checked = $state(false);
  let on = $state(true);
  let date = $state('');
  let fselect = $state('');
  let fchecked = $state(false);
  let fdate = $state('');
  let radio = $state('email');
  let combo = $state('');
  let phone = $state('');
  let range = $state({ start: '', end: '' });
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

  <div class="flex flex-col gap-1">
    <Label text="Standalone Label" required for="standalone-input" />
    <TextField id="standalone-input" placeholder="Labelled via <Label for>" />
  </div>

  <FormSelect
    bind:value={fselect}
    label="FormSelect"
    placeholder="Choose…"
    options={[
      { value: 'x', label: 'Option X' },
      { value: 'y', label: 'Option Y' },
    ]}
  />

  <FormCheckbox bind:checked={fchecked} label="FormCheckbox" error={fchecked ? '' : 'You must accept'} />

  <FormDatePicker bind:value={fdate} label="FormDatePicker" placeholder="Pick a date" />

  <RadioGroup
    bind:value={radio}
    label="RadioGroup"
    options={[
      { value: 'email', label: 'Email' },
      { value: 'sms', label: 'SMS' },
      { value: 'push', label: 'Push' },
    ]}
  />

  <Combobox
    bind:value={combo}
    label="Combobox (searchable, creatable)"
    creatable
    options={[
      { value: 'almaty', label: 'Almaty' },
      { value: 'astana', label: 'Astana' },
      { value: 'shymkent', label: 'Shymkent' },
    ]}
  />

  <PhoneInput bind:value={phone} label="PhoneInput" defaultCountryCode="+7" />

  <DateRangePicker bind:value={range} label="DateRangePicker" />

  <p class="text-body-sm text-on-surface-variant">
    text=<code>{text}</code> · select=<code>{select}</code> ·
    checked=<code>{checked}</code> · on=<code>{on}</code> · date=<code>{date}</code> ·
    radio=<code>{radio}</code> · combo=<code>{combo}</code> · phone=<code>{phone}</code> ·
    range=<code>{range.start}→{range.end}</code>
  </p>
</div>
