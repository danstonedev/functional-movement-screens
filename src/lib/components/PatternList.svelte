<script lang="ts">
  import { PATTERNS, patternTitle } from '$lib/data/breakouts';
  interface Props { selected: string; completed: Record<string, boolean>; onselect: (id: string) => void; }
  let { selected, completed, onselect }: Props = $props();
</script>

<div class="card" id="pats">
  <div class="eyebrow hd">Top-tier pattern</div>
  <div class="ps">
    {#each PATTERNS as p (p.patternId)}
      <button
        aria-current={p.patternId === selected ? "true" : undefined} data-done={completed[p.patternId] ? 1 : 0}
        onclick={() => onselect(p.patternId)}
      >
        <span class="k"></span>{patternTitle(p.patternId)}<span class="c">{p.nodes.length}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  #pats{top:14px;left:14px;padding:8px;max-width:246px}
  .hd{padding:3px 8px 7px}
  .ps{display:flex;flex-direction:column;gap:1px;max-height:calc(100vh - 210px);overflow:auto}
  button{
    display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:none;border:0;
    border-radius:8px;padding:6px 8px;cursor:pointer;font-size:12.7px;font-weight:600;
    color:var(--ink-2);line-height:1.2;
  }
  button:hover{background:#eef1f5}
  button[aria-current='true']{background:#000;color:#fff}
  .k{width:7px;height:7px;border-radius:50%;background:#cfd6de;flex:0 0 auto}
  button[data-done='1'] .k{background:var(--fn)}
  .c{margin-left:auto;font-size:10.5px;font-weight:700;opacity:.55;font-variant-numeric:tabular-nums}
  @media (max-width:860px){#pats{max-width:172px}}
</style>
