<script lang="ts">
  import { NEAR_LIMIT_RATIO } from '../lib/storage/limits';

  let { used, limit }: { used: number; limit: number } = $props();

  const ratio = $derived(limit === 0 ? 0 : used / limit);
  const level = $derived(used > limit ? 'over' : ratio >= NEAR_LIMIT_RATIO ? 'near' : 'ok');
</script>

<span class="counter {level}" title={`${used} of ${limit} characters`}>
  {used}/{limit}
</span>

<style>
  .counter {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--text-muted);
  }

  .counter.near {
    color: #d97706;
  }

  .counter.over {
    color: #dc2626;
    font-weight: 600;
  }
</style>
