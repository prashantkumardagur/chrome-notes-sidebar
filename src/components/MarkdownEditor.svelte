<script lang="ts">
  let {
    value = $bindable(''),
    oninput,
    maxlength,
  }: { value: string; oninput?: () => void; maxlength?: number } = $props();
</script>

<textarea
  class="editor"
  bind:value
  {oninput}
  {maxlength}
  spellcheck="true"
  placeholder="Write your note in Markdown…"
  aria-label="Markdown editor"
></textarea>

<style>
  .editor {
    width: 100%;
    height: 100%;
    resize: none;
    border: none;
    outline: none;
    background: var(--bg);
    color: var(--text);
    padding: 12px 16px;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 13px;
    line-height: 1.6;
    tab-size: 2;
  }
</style>
