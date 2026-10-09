<script>
  import BottomSheet from '../BottomSheet.svelte'

  let { onpick = () => {}, sheetClass = '' } = $props()
</script>

<BottomSheet open={true} snapPoints={[0.5, 1]} dismissible={false} backdrop={false} modal={false} respectBack={false} class={sheetClass}>
  <button type="button" data-testid="sheet-button" onclick={onpick}>pick</button>
</BottomSheet>
