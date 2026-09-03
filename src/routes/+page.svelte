<script lang="ts">
  import '../app.css';
  import Board from '$lib/components/Board.svelte';
  import DetailCard from '$lib/components/DetailCard.svelte';
  import FindingsPanel from '$lib/components/FindingsPanel.svelte';
  import PatternList from '$lib/components/PatternList.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import {
    CONCLUSION_LABELS, CONCLUSION_NOTE, PATTERNS, getPattern, patternTitle, type Rating,
  } from '$lib/data/breakouts';
  import {
    currentNode, findingsOf, isComplete, pairing, prune, verdict, walk, type Answers,
  } from '$lib/engine/graph';

  let patternId = $state(PATTERNS[0].patternId);
  let answers = $state<Answers>({});
  let showAll = $state(false);
  /** Each pattern keeps its own progress while you browse between them. */
  let saved = $state<Record<string, Answers>>({});
  let board: Board;
  let zoom = $state(1);

  const pattern = $derived(getPattern(patternId)!);
  const path = $derived(walk(pattern, answers));
  const current = $derived(showAll ? null : currentNode(path));
  const findings = $derived(findingsOf(path));
  const complete = $derived(isComplete(path));
  const result = $derived(complete ? verdict(path) : '');
  const isAssist = $derived(!!current && !!pairing(pattern).isPartner[current.id]);
  const completed = $derived(
    Object.fromEntries(
      PATTERNS.map((p) => [
        p.patternId,
        p.patternId === patternId ? complete : isComplete(walk(p, saved[p.patternId] ?? {})),
      ]),
    ),
  );

  function pick(nodeId: string, rating: Rating) {
    answers = prune(pattern, { ...answers, [nodeId]: rating });
    queueMicrotask(() => board?.focus());
  }
  function select(id: string) {
    saved = { ...saved, [patternId]: answers };
    patternId = id;
    answers = saved[id] ?? {};
    queueMicrotask(() => board?.fit());
  }
  function reset() {
    answers = {};
    queueMicrotask(() => board?.fit());
  }
  function setMode(all: boolean) {
    showAll = all;
    queueMicrotask(() => board?.fit());
  }
  $effect(() => { zoom = board?.zoomLevel() ?? 1; });
</script>

<svelte:head>
  <title>Breakout Board — SFMA</title>
</svelte:head>

<Board
  bind:this={board}
  {pattern} {answers} {showAll}
  current={current?.id ?? null}
  onpick={pick}
/>

<PatternList selected={patternId} {completed} onselect={select} />

<Toolbar
  {zoom} {showAll}
  onzoom={(f) => { board.zoomBy(f); zoom = board.zoomLevel(); }}
  onfit={() => { board.fit(); zoom = board.zoomLevel(); }}
  onmode={setMode}
  onreset={reset}
/>

<DetailCard
  node={current} step={path.length} total={pattern.nodes.length}
  title={patternTitle(patternId)} {isAssist} {showAll}
/>

<FindingsPanel {findings} />

{#if result && !showAll}
  <div id="done">
    <div class="lab">{patternTitle(patternId)} · complete</div>
    <h3>{CONCLUSION_LABELS[result]}</h3>
    <p>{CONCLUSION_NOTE[result]}</p>
  </div>
{/if}

<style>
  #done{
    position:fixed;z-index:41;left:50%;bottom:14px;transform:translateX(-50%);max-width:430px;
    background:#000;color:#fff;border-radius:14px;padding:14px 18px;
    box-shadow:0 10px 28px -14px rgba(0,0,0,.6);
  }
  .lab{font-size:9.5px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;opacity:.6}
  h3{margin:5px 0 0;font-size:19px;font-weight:800;line-height:1.2}
  p{margin:7px 0 0;font-size:13px;font-weight:500;line-height:1.45;opacity:.82}
</style>
