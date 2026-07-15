import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/lib/markdown/render';

describe('renderMarkdown (GFM)', () => {
  it('renders headings', () => {
    expect(renderMarkdown('# Hello')).toContain('<h1>Hello</h1>');
  });

  it('renders emphasis and inline code', () => {
    const html = renderMarkdown('**bold** _italic_ `code`');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
  });

  it('renders GFM tables', () => {
    const md = ['| A | B |', '| - | - |', '| 1 | 2 |'].join('\n');
    const html = renderMarkdown(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>A</th>');
    expect(html).toContain('<td>1</td>');
  });

  it('renders task lists as checkboxes', () => {
    const html = renderMarkdown('- [x] done\n- [ ] todo');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
  });

  it('renders fenced code blocks', () => {
    const html = renderMarkdown('```\nconst x = 1;\n```');
    expect(html).toContain('<pre>');
    expect(html).toContain('const x = 1;');
  });

  it('handles empty / nullish input safely', () => {
    expect(renderMarkdown('')).toBe('');
    // @ts-expect-error exercising defensive nullish handling
    expect(renderMarkdown(undefined)).toBe('');
  });

  describe('sanitization (untrusted content)', () => {
    it('strips <script> tags', () => {
      const html = renderMarkdown('Hi<script>alert(1)</script>');
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('alert(1)');
    });

    it('strips inline event handlers', () => {
      const html = renderMarkdown('<img src=x onerror="alert(1)">');
      expect(html.toLowerCase()).not.toContain('onerror');
    });

    it('drops javascript: URLs', () => {
      const html = renderMarkdown('[click](javascript:alert(1))');
      expect(html).not.toContain('javascript:');
    });
  });
});
