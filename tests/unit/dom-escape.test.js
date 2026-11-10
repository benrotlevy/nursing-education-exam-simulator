import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHTML, rawHTML, html, isRawHTML } from '../../app/js/ui/dom.js';

describe('app/js/ui/dom.js — XSS Auto-Escaping & Safe HTML Composition (SEC-01)', () => {
  it('escapes &, <, >, ", and \' in untrusted strings', () => {
    const payload = `<script>alert("xss" & 'owned')</script>`;
    assert.equal(
      escapeHTML(payload),
      '&lt;script&gt;alert(&quot;xss&quot; &amp; &#39;owned&#39;)&lt;/script&gt;'
    );
    assert.equal(escapeHTML(null), '');
    assert.equal(escapeHTML(undefined), '');
  });

  it('auto-escapes interpolated primitives and arrays inside html`` template tags', () => {
    const malicious = `<img src=x onerror="alert(1)">`;
    const items = ['<b>א</b>', '<i>ב</i>'];
    // prettier-ignore
    const rendered = html`<div class="card">${malicious}<ul>${items}</ul></div>`;

    assert.equal(isRawHTML(rendered), true);
    assert.equal(
      String(rendered),
      '<div class="card">&lt;img src=x onerror=&quot;alert(1)&quot;&gt;<ul>&lt;b&gt;א&lt;/b&gt;&lt;i&gt;ב&lt;/i&gt;</ul></div>'
    );
  });

  it('preserves trusted markup wrapped in rawHTML() or nested html`` templates without double-escaping', () => {
    const badge = html`<span class="badge">${'ציון > 80%'}</span>`;
    const card = html`<section>${badge}${rawHTML('<hr>')}</section>`;

    assert.equal(String(card), '<section><span class="badge">ציון &gt; 80%</span><hr></section>');
  });
});
