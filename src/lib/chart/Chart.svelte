<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Chart as ChartJS,
    type ChartType,
    type ChartData,
    type ChartOptions,
    BarController, LineController, DoughnutController, PieController, RadarController, PolarAreaController,
    ArcElement, LineElement, BarElement, PointElement,
    CategoryScale, LinearScale, RadialLinearScale, TimeScale,
    Title, Tooltip, Legend, Filler,
  } from 'chart.js';
  import { cn } from '../ui/utils/cn';

  // Register the controllers/elements the kit supports. Tree-shaken to what's
  // imported here; consumers needing exotic chart types can register more.
  ChartJS.register(
    BarController, LineController, DoughnutController, PieController, RadarController, PolarAreaController,
    ArcElement, LineElement, BarElement, PointElement,
    CategoryScale, LinearScale, RadialLinearScale, TimeScale,
    Title, Tooltip, Legend, Filler,
  );

  /**
   * Chart wrapper over chart.js (Bar/Line/Doughnut/…). SSR-safe: the canvas is
   * only initialised on mount. Reactive — updates in place when `data`/`options`
   * change. Wrap in a sized container to control dimensions.
   *
   * Note: built directly on chart.js (not svelte-chartjs, which is Svelte 4-only).
   *
   * @example
   * <div class="h-64">
   *   <Chart type="bar" data={{ labels, datasets }} />
   * </div>
   */
  let {
    type = 'bar',
    data,
    options = {},
    class: className,
    ...restProps
  }: {
    type?: ChartType;
    data: ChartData;
    options?: ChartOptions;
    class?: string;
    [key: string]: any;
  } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let chart: ChartJS | null = null;

  const defaultOptions: ChartOptions = { responsive: true, maintainAspectRatio: false };

  onMount(() => {
    if (!canvas) return;
    chart = new ChartJS(canvas, { type, data, options: { ...defaultOptions, ...options } });
    return () => { chart?.destroy(); chart = null; };
  });

  // Reactively push data/options updates into the existing chart instance.
  $effect(() => {
    if (!chart) return;
    // touch reactive deps
    const d = data;
    const o = options;
    chart.data = d as any;
    chart.options = { ...defaultOptions, ...o };
    chart.update();
  });
</script>

<canvas bind:this={canvas} class={cn('block', className)} {...restProps}></canvas>
