<script>
  import BottomSheet from '../BottomSheet.svelte'

  let { onpick = () => {} } = $props()
</script>

<BottomSheet open={true} snapPoints={[0.5, 1]} dismissible={false} backdrop={false} modal={false} respectBack={false}>
  <button type="button" data-testid="sheet-button" onclick={onpick}>pick</button>
</BottomSheet>
