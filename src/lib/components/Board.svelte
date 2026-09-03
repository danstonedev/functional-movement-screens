<script lang="ts">
  import { CONCLUSION_CODE, type Pattern, type Rating, type TestNode } from '$lib/data/breakouts';
  import { G, layout } from '$lib/engine/layout';
  import type { Answers } from '$lib/engine/graph';

  interface Props {
    pattern: Pattern;
    answers: Answers;
    current: string | null;
    showAll: boolean;
    onpick: (nodeId: string, rating: Rating) => void;
  }
  let { pattern, answers, current, showAll, onpick }: Props = $props();

  const nodes = $derived(Object.fromEntries(pattern.nodes.map((n) => [n.id, n])) as Record<string, TestNode>);

  /* Boxes wrap to their content, so heights are measured and fed back into the pure layout. */
  let heights = $state<Record<string, number>>({});
  let boxEls: Record<string, HTMLElement | null> = $state({});
  const board = $derived(layout(pattern, heights));

  $effect(() => {
    void pattern.patternId;
    const next: Record<string, number> = {};
    let changed = false;
    for (const n of pattern.nodes) {
      const h = boxEls[n.id]?.offsetHeight;
      if (!h) continue;
      next[n.id] = h;
      if (heights[n.id] !== h) changed = true;
    }
    if (changed) heights = { ...heights, ...next };
  });

  /* Everything on the path is lit; the rest of the board stays visible but recedes. */
  const reached = $derived(new Set(walkIds()));
  function walkIds(): string[] {
    const out: string[] = [];
    let id: string | undefined = pattern.start;
    let guard = 0;
    while (id !== undefined && guard++ <= pattern.nodes.length) {
      const here: string = id;
      out.push(here);
      const r: Rating | undefined = answers[here];
      if (!r) break;
      id = nodes[here].branches[r].next;
    }
    return out;
  }
  const live = (id: string) => showAll || reached.has(id);
  const unitState = (id: string) =>
    showAll ? 'on' : reached.has(id) ? (id === current ? 'now' : 'on') : 'dim';

  function chevState(nodeId: string, rs: Rating[]) {
    if (showAll) return 'off';
    if (!live(nodeId)) return 'dim';
    const picked = answers[nodeId];
    if (!picked) return '';
    return rs.includes(picked) ? 'on' : 'dim';
  }
  const cellClass = (c: string | undefined) =>
    ({ SMCD: 'o-smcd', MD: 'o-md', 'P/D': 'o-pd' } as Record<string, string>)[c ?? ''] ?? 'o-mix';

  /* ---- viewport ---- */
  let zoom = $state(1);
  let pan = $state({ x: 0, y: 0 });
  let canvas: HTMLElement;
  let dragFrom = $state<{ x: number; y: number } | null>(null);

  export function zoomBy(f: number) { setZoom(zoom * f); }
  export function zoomLevel() { return zoom; }
  export function fit() {
    const padL = innerWidth > 860 ? 278 : 186, padR = innerWidth > 860 ? 288 : 26;
    const aw = innerWidth - padL - padR, ah = innerHeight - 108;
    zoom = Math.min(1.05, Math.max(0.42, aw / board.width));
    pan = { x: padL + Math.max(0, (aw - board.width * zoom) / 2),
            y: 82 + Math.max(0, (ah - board.height * zoom) / 2) };
    focus();
  }
  /** Keep the test being asked about on screen without yanking the whole board around. */
  export function focus() {
    if (!current) return;
    const u = board.byId[current];
    if (!u || board.height * zoom <= innerHeight - 108) return;
    const want = 82 + (innerHeight - 108) * 0.34 - (u.boxY + u.boxH / 2) * zoom;
    pan = { ...pan, y: Math.min(82, Math.max(innerHeight - 26 - board.height * zoom, want)) };
  }
  function setZoom(z: number, ox = innerWidth / 2, oy = innerHeight / 2) {
    const nz = Math.min(2.2, Math.max(0.22, z));
    pan = { x: ox - (ox - pan.x) * (nz / zoom), y: oy - (oy - pan.y) * (nz / zoom) };
    zoom = nz;
  }
  function down(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('button')) return;
    dragFrom = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    canvas.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!dragFrom) return;
    pan = { x: e.clientX - dragFrom.x, y: e.clientY - dragFrom.y };
  }
  const up = () => { dragFrom = null; };
  function wheel(e: WheelEvent) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX, e.clientY);
    else pan = { x: pan.x - e.deltaX, y: pan.y - e.deltaY };
  }
</script>

<svelte:window on:resize={fit} />

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={canvas} id="canvas" class:drag={!!dragFrom}
  role="application" aria-label="Breakout board — drag to pan, ctrl or cmd and scroll to zoom"
  tabindex="-1"
  onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onwheel={wheel}
>
  <div id="world" style="transform: translate({pan.x}px,{pan.y}px) scale({zoom});
       width:{board.width}px; height:{board.height}px">

    {#each board.units as u (u.id)}
      {@const n = nodes[u.id]}
      {@const st = unitState(u.id)}
      {#if u.hasBar}
        <div class="sect" data-s={st} style="left:{u.x}px; top:{u.unitTop}px; width:{G.W}px">{u.region}</div>
      {/if}
      <div
        class="box" data-s={st} bind:this={boxEls[u.id]}
        style="left:{u.x}px; top:{u.boxY}px; width:{G.W}px"
      >
        {#if !showAll && u.id === current}<span class="now">You are here</span>{/if}
        {#if !showAll && answers[u.id]}
          <span class="pick b-{answers[u.id]}">{answers[u.id]}</span>
        {/if}
        <div class="t">{n.short}</div>
        <div class="m">
          {#if n.mode === 'active'}<i>Active</i>
          {:else if n.mode === 'passive'}<i class="assist">Passive</i>
          {:else if n.mode === 'stabilized'}<i class="assist">Stabilised</i>{/if}
          {#if n.position}<u>{n.position}</u>{/if}
        </div>
      </div>
    {/each}

    {#each board.strips as s (s.nodeId)}
      <div class="strip" data-s={unitState(s.nodeId)} style="left:{s.x}px; top:{s.y}px; width:{s.w}px">
        <span class="lab">{s.label}</span>
        {#each s.cells as c}
          {@const picked = answers[s.nodeId]}
          {@const hit = !!picked && c.ratings.includes(picked)}
          {@const off = showAll || !live(s.nodeId) || (!!picked && !hit)}
          <button
            class={cellClass(c.code)} data-s={hit ? 'on' : off ? 'off' : ''}
            title="{c.ratings.join(' / ')} — {c.finding}{c.continuesTo
              ? '\n↓ then ' + nodes[c.continuesTo].short : '\n(ends the breakout)'}"
            disabled={off}
            onclick={() => onpick(s.nodeId, c.ratings[0])}
          >{c.code}<small>{c.ratings.join('/')}{c.continuesTo ? ' ↓' : ''}</small></button>
        {/each}
      </div>
    {/each}

    {#each board.chevrons as c, i (c.nodeId + c.ratings.join() + i)}
      {@const st = chevState(c.nodeId, c.ratings)}
      <button
        class="chev" data-k={c.kind} data-s={st} disabled={showAll || !live(c.nodeId)}
        style="left:{c.x}px; top:{c.y}px; width:{c.w}px; height:{c.h}px"
        title={c.ratings.map((r) => `${r} → ${nodes[c.targetId].short}`).join('\n')}
        onclick={() => onpick(c.nodeId, c.ratings[0])}
      ><span class="fill"></span><span class="l">{c.ratings.join(' ')}</span></button>
    {/each}

    {#each board.jumps as j, i (j.nodeId + i)}
      <div class="jump" data-s={chevState(j.nodeId, j.ratings) || 'on'} style="left:{j.x}px; top:{j.y}px">
        ↓ {nodes[j.targetId].short}
      </div>
    {/each}
  </div>
</div>

<style>
  #canvas{position:fixed;inset:0;cursor:grab;background:var(--bg);touch-action:none}
  #canvas.drag{cursor:grabbing}
  #world{position:absolute;top:0;left:0;transform-origin:0 0;will-change:transform}

  .sect{
    position:absolute;background:#000;color:#fff;font-weight:800;font-style:italic;font-size:15.5px;
    padding:6px 14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    border:3px solid #000;border-bottom:0;transition:opacity .25s,filter .25s;
  }
  .box{
    position:absolute;background:var(--card);border:3px solid #000;padding:11px 14px;
    transition:opacity .25s,filter .25s,box-shadow .2s;
  }
  .box .t{font-weight:700;font-size:16.5px;line-height:1.2}
  .box .m{display:flex;gap:6px;align-items:center;margin-top:6px}
  .box .m i{
    font-style:normal;font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;
    border:2px solid #000;padding:0 5px;line-height:16px;
  }
  .box .m i.assist{background:#000;color:#fff}
  .box .m u{text-decoration:none;font-size:11px;font-weight:600;color:var(--ink-2)}
  .box .now{
    position:absolute;top:-14px;left:-3px;font-weight:900;font-size:10.5px;letter-spacing:.1em;
    text-transform:uppercase;background:var(--sel);color:#fff;padding:2px 9px;z-index:4;
  }
  .box .pick{
    position:absolute;top:-14px;right:-3px;font-weight:900;font-size:11.5px;color:#fff;
    padding:2px 8px;letter-spacing:.05em;z-index:4;
  }
  [data-s='dim']{opacity:.3;filter:grayscale(1)}
  .box[data-s='now']{box-shadow:0 0 0 5px rgba(29,78,216,.32)}

  .strip{position:absolute;display:flex;border:3px solid #000;border-top:0;overflow:hidden;
    transition:opacity .25s,filter .25s}
  .strip .lab{
    flex:1 1 auto;background:#000;color:#fff;font-weight:800;font-size:12px;padding:7px 11px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  }
  .strip button{
    flex:0 0 auto;border:0;border-left:3px solid #000;padding:7px 4px;cursor:pointer;color:#fff;
    font-weight:900;font-size:12.5px;letter-spacing:.03em;min-width:62px;
    display:flex;flex-direction:column;align-items:center;gap:1px;transition:filter .15s,box-shadow .15s;
  }
  .strip button small{font-size:9px;font-weight:800;opacity:.85;letter-spacing:.06em}
  .strip button:hover:not(:disabled){filter:brightness(1.14)}
  .strip .o-smcd{background:var(--fn)}
  .strip .o-md{background:var(--dn)}
  .strip .o-pd{background:var(--pain)}
  .strip .o-mix{background:#5b6470}
  .strip button[data-s='on']{box-shadow:inset 0 0 0 3px #facc15;filter:brightness(1.1)}
  .strip button[data-s='off']{opacity:.34;filter:grayscale(.7);cursor:default}

  .chev{
    position:absolute;border:0;padding:0;background:transparent;cursor:pointer;
    transition:opacity .22s,filter .22s,transform .16s;
  }
  .chev .fill{
    position:absolute;inset:0;transition:background .16s,box-shadow .16s;
    clip-path:polygon(0 0,100% 0,100% calc(100% - 17px),50% 100%,0 calc(100% - 17px));
  }
  .chev .l{
    position:relative;display:block;padding-top:8px;color:#fff;font-weight:900;font-size:14px;
    letter-spacing:.04em;text-shadow:0 1px 2px rgba(0,0,0,.28);line-height:1.05;
  }
  .chev[data-k='FN'] .fill{background:var(--fn)}
  .chev[data-k='DN'] .fill{background:var(--dn)}
  .chev[data-k='P'] .fill{background:var(--pain)}
  .chev:hover:not(:disabled){transform:scale(1.05)}
  .chev[data-s='on']{transform:scale(1.07);z-index:6}
  .chev[data-s='on'][data-k='FN'] .fill{background:var(--fn-hi);box-shadow:0 0 20px 2px rgba(31,170,84,.9)}
  .chev[data-s='on'][data-k='DN'] .fill{background:var(--dn-hi);box-shadow:0 0 20px 2px rgba(239,139,44,.9)}
  .chev[data-s='on'][data-k='P'] .fill{background:var(--pain-hi);box-shadow:0 0 20px 2px rgba(210,35,42,.9)}
  .chev[data-s='dim']{opacity:.17;filter:grayscale(1);transform:none}
  .chev[data-s='off']{opacity:.55}
  .chev:disabled{cursor:default}

  .jump{
    position:absolute;background:#000;color:#fff;font-size:10.5px;font-weight:800;padding:3px 8px;
    white-space:nowrap;z-index:2;transition:opacity .25s,filter .25s;
    max-width:250px;overflow:hidden;text-overflow:ellipsis;
  }
  .jump[data-s='dim']{opacity:.18;filter:grayscale(1)}
  .jump[data-s='on']{background:var(--sel)}
</style>
