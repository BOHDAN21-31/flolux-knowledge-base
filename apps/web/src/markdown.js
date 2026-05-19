import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ breaks: true, gfm: true });

// marked НЕ санітизує сирий HTML — обов'язково чистимо через DOMPurify.
export function renderMarkdown(text) {
  const raw = marked.parse(String(text || ''));
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
}
