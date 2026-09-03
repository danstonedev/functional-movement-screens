<script lang="ts">
  import type { Finding } from '$lib/engine/graph';
  interface Props { findings: Finding[]; }
  let { findings }: Props = $props();
</script>

<div class="card" id="tally">
  <div class="hd"><span class="eyebrow">Findings</span><em>{findings.length || ''}</em></div>
  <ul>
    {#each findings as f, i (f.test + i)}
      <li><span class="r b-{f.rating}">{f.rating}</span><span class="x">{f.finding}</span></li>
    {:else}
      <li class="none">Nothing yet — findings land here as branches resolve.</li>
    {/each}
  </ul>
</div>

<style>
  #tally{right:14px;bottom:14px;width:262px;max-height:52vh;display:flex;flex-direction:column}
  .hd{display:flex;justify-content:space-between;align-items:center;padding:10px 13px}
  .hd em{font-style:normal;font-weight:800;font-size:11px;color:var(--ink-3)}
  ul{margin:0;padding:0;list-style:none;overflow:auto}
  li{display:flex;gap:8px;padding:8px 13px;border-top:1px solid var(--line2);align-items:flex-start}
  .r{font-weight:900;font-size:10px;color:#fff;padding:1px 5px;flex:0 0 auto;margin-top:1px}
  .x{font-size:12.2px;font-weight:600;line-height:1.3;color:var(--ink-2)}
  .none{font-size:12.3px;font-weight:500;color:var(--ink-3);display:block}
  @media (max-width:860px){#tally{display:none}}
</style>
