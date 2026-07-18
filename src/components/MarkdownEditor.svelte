<script lang="ts">
  import { selectRangeInTextarea } from '../lib/search/highlight';

  let {
    value = $bindable(''),
    oninput,
    maxlength,
    select = null,
  }: {
    value: string;
    oninput?: () => void;
    maxlength?: number;
    // Set when a note is opened from a search result in Edit mode: the exact body
    // range to select + scroll into view. App clears it after so it can't re-fire.
    select?: { start: number; end: number } | null;
  } = $props();

  let textarea: HTMLTextAreaElement;

  $effect(() => {
    if (select && textarea) selectRangeInTextarea(textarea, select.start, select.end);
  });
</script>

<textarea
  class="editor"
  bind:this={textarea}
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
