<script lang="ts">
  interface Props {
    zoom: number; showAll: boolean;
    onzoom: (f: number) => void; onfit: () => void;
    onmode: (all: boolean) => void; onreset: () => void;
  }
  let { zoom, showAll, onzoom, onfit, onmode, onreset }: Props = $props();
</script>

<div class="pill" id="tools">
  <button onclick={() => onzoom(1 / 1.2)} title="Zoom out" aria-label="Zoom out">
    <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5M8 11h6" /></svg>
  </button>
  <span class="z">{Math.round(zoom * 100)}%</span>
  <button onclick={() => onzoom(1.2)} title="Zoom in" aria-label="Zoom in">
    <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5M8 11h6M11 8v6" /></svg>
  </button>
  <button onclick={onfit} title="Fit to screen">
    <svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
    <span class="lb">Fit</span>
  </button>
  <span class="sep"></span>
  <button aria-pressed={!showAll} onclick={() => onmode(false)}>
    <svg viewBox="0 0 24 24"><path d="M4 3l7 17 2.5-7L20 10.5z" /></svg><span class="lb">Walk it</span>
  </button>
  <button aria-pressed={showAll} onclick={() => onmode(true)}>
    <svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="2.6" /></svg>
    <span class="lb">Show all</span>
  </button>
  <span class="sep"></span>
  <button onclick={onreset}>
    <svg viewBox="0 0 24 24"><path d="M3 11a9 9 0 1 1 2.6 6.4M3 17v-6h6" /></svg><span class="lb">Reset</span>
  </button>
</div>

<style>
  #tools{top:14px;left:50%;transform:translateX(-50%);padding:6px;gap:2px}
  #tools button{
    background:none;border:0;border-radius:999px;padding:7px 11px;cursor:pointer;font-size:13px;
    font-weight:700;color:var(--ink-2);display:flex;align-items:center;gap:6px;white-space:nowrap;
  }
  #tools button:hover{background:#eef1f5;color:#000}
  #tools button[aria-pressed='true']{background:var(--sel);color:#fff}
  .z{font-variant-numeric:tabular-nums;font-weight:700;font-size:12.5px;color:var(--ink-3);width:46px;text-align:center}
  .sep{width:1px;align-self:stretch;background:var(--line2);margin:2px 5px}
  #tools svg{width:17px;height:17px;stroke:currentColor;stroke-width:2.1;fill:none;stroke-linecap:round;stroke-linejoin:round}
  @media (max-width:860px){#tools .lb{display:none}}
</style>
