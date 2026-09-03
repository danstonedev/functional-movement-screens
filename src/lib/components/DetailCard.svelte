<script lang="ts">
  import type { TestNode } from '$lib/data/breakouts';
  interface Props { node: TestNode | null; step: number; total: number; title: string; isAssist: boolean; showAll: boolean; }
  let { node, step, total, title, isAssist, showAll }: Props = $props();

  /* The rule this test is an instance of. Three rules cover almost the whole graph. */
  const rule = $derived(
    !node ? null
    : isAssist
      ? { n: 'Rule 1 · assisted retest',
          t: 'Same motion, effort removed. Range appears → a control problem. Still short → a mobility problem.' }
      : node.mode === 'active'
        ? { n: 'Rule 1 · active first',
            t: 'If this fails you repeat it with help. That comparison is the whole answer.' }
        : { n: 'Rule 3 · pain ends it', t: 'Any FP or DP stops the breakout where it stands.' },
  );
</script>

<div class="card" id="detail">
  <div class="top">
    {#if node}
      <div class="eyebrow">{node.region} · test {step} of {total}</div>
      <h2>{node.short}</h2>
      <p class="crit"><b>Pass:</b> {node.criterion}</p>
    {:else if showAll}
      <div class="eyebrow">{title}</div>
      <h2>Whole map</h2>
      <p class="crit">Every test at once. Switch to <b>Walk it</b> to rate them one at a time.</p>
    {:else}
      <div class="eyebrow">{title}</div>
      <h2>Breakout complete</h2>
      <p class="crit">Hit <b>Reset</b> to run it again, or pick another pattern.</p>
    {/if}
  </div>
  {#if rule}
    <div class="hint"><b>{rule.n}</b>{rule.t}</div>
  {/if}
</div>

<style>
  #detail{left:14px;bottom:14px;width:292px}
  .top{padding:12px 14px 13px}
  h2{margin:5px 0 0;font-size:17px;font-weight:800;line-height:1.18;letter-spacing:-.01em}
  .crit{margin:9px 0 0;font-size:13px;font-weight:500;line-height:1.42;color:var(--ink-2)}
  .crit b{color:var(--fn);font-weight:800}
  .hint{padding:11px 14px;border-top:1px solid var(--line2);font-size:12.6px;line-height:1.45;font-weight:500;color:var(--ink-2)}
  .hint b{display:block;font-size:9.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px;color:var(--dn)}
  @media (max-width:860px){#detail{width:224px}}
</style>
