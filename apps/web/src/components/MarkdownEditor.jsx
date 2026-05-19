import { useRef, useState } from 'react';
import { Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Link2, Code, Minus, Eye, Pencil } from 'lucide-react';
import { renderMarkdown } from '../markdown';

const Btn = ({ title, onClick, children }) => (
  <button type="button" title={title} onClick={onClick}
    className="w-9 h-9 flex items-center justify-center rounded text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700">
    {children}
  </button>
);

export default function MarkdownEditor({ value, onChange, placeholder }) {
  const ref = useRef(null);
  const [preview, setPreview] = useState(false);

  const surround = (before, after = before) => {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = value.slice(s, e);
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = s + before.length;
      ta.selectionEnd = e + before.length;
    });
  };

  const linePrefix = (prefix) => {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + prefix.length; });
  };

  const insert = (text) => {
    const ta = ref.current;
    const s = ta ? ta.selectionStart : value.length;
    onChange(value.slice(0, s) + text + value.slice(s));
  };

  const addLink = () => {
    const url = window.prompt('URL посилання:');
    if (!url) return;
    const label = window.prompt('Текст посилання:', 'посилання') || url;
    insert(`[${label}](${url})`);
  };

  return (
    <div className="border border-stone-200 dark:border-stone-700 rounded-md overflow-hidden">
      <div className="flex items-center gap-0.5 flex-wrap px-1 py-1 border-b border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800">
        <Btn title="Жирний" onClick={() => surround('**')}><Bold className="w-4 h-4" /></Btn>
        <Btn title="Курсив" onClick={() => surround('*')}><Italic className="w-4 h-4" /></Btn>
        <Btn title="Заголовок 1" onClick={() => linePrefix('# ')}><Heading1 className="w-4 h-4" /></Btn>
        <Btn title="Заголовок 2" onClick={() => linePrefix('## ')}><Heading2 className="w-4 h-4" /></Btn>
        <Btn title="Заголовок 3" onClick={() => linePrefix('### ')}><Heading3 className="w-4 h-4" /></Btn>
        <Btn title="Список" onClick={() => linePrefix('- ')}><List className="w-4 h-4" /></Btn>
        <Btn title="Нумерований список" onClick={() => linePrefix('1. ')}><ListOrdered className="w-4 h-4" /></Btn>
        <Btn title="Цитата" onClick={() => linePrefix('> ')}><Quote className="w-4 h-4" /></Btn>
        <Btn title="Посилання" onClick={addLink}><Link2 className="w-4 h-4" /></Btn>
        <Btn title="Код" onClick={() => surround('`')}><Code className="w-4 h-4" /></Btn>
        <Btn title="Розділювач" onClick={() => insert('\n\n---\n\n')}><Minus className="w-4 h-4" /></Btn>
        <button type="button" onClick={() => setPreview((p) => !p)}
          className="ml-auto flex items-center gap-1 px-3 h-9 rounded text-sm text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700">
          {preview ? <><Pencil className="w-4 h-4" /> Редагувати</> : <><Eye className="w-4 h-4" /> Прев'ю</>}
        </button>
      </div>
      {preview ? (
        <div className="p-3 prose prose-stone dark:prose-invert max-w-none text-stone-700 dark:text-stone-200 min-h-[200px] max-h-[600px] overflow-y-auto"
          style={{ fontFamily: 'system-ui, sans-serif', fontSize: '15px', lineHeight: '1.7' }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }} />
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full p-3 min-h-[200px] max-h-[600px] resize-y bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:outline-none"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        />
      )}
    </div>
  );
}
