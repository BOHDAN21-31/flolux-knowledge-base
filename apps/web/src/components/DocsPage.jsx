import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Shield, Clock, MessageCircle, FileCheck, FileText, Plus, Check,
  AlertCircle, ChevronRight, ChevronDown, Edit3, Trash2, X, ArrowUp, ArrowDown,
  History, Eye, EyeOff,
} from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api';
import { DOC_CATEGORIES, docCategory } from '../constants';
import { renderMarkdown } from '../markdown';
import MarkdownEditor from './MarkdownEditor';
import { useConfirm } from './ConfirmDialog';
import { useRoles } from '../RolesContext';

const CAT_ICONS = { Shield, Clock, MessageCircle, FileCheck, FileText };

function catIcon(key) {
  const c = docCategory(key);
  if (!c) return FileText;
  return CAT_ICONS[c.iconName] || FileText;
}

// ============ СПИСОК ДОКУМЕНТІВ ============
export default function DocsPage({ onBack, onOpenDoc, onEditDoc, onCreateDoc, canManage = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  const load = () => {
    setLoading(true);
    apiGet('/api/docs')
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const byCategory = useMemo(() => {
    const m = {};
    items.forEach((d) => { (m[d.category] = m[d.category] || []).push(d); });
    return m;
  }, [items]);

  const shown = catFilter === 'all' ? items : items.filter((d) => d.category === catFilter);

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 mb-4 min-h-[44px]">
        <ArrowLeft className="w-4 h-4" /> Повернутися
      </button>

      <div className="mb-6 md:mb-8 pb-6 border-b border-stone-200 dark:border-stone-700 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Регуляторні матеріали</p>
          <h1 className="text-2xl md:text-3xl text-stone-800 dark:text-stone-100">📋 Правила компанії</h1>
          <p className="text-stone-500 dark:text-stone-400 italic mt-1">Офіційні документи, SOP, політики</p>
        </div>
        {canManage && (
          <button onClick={onCreateDoc}
            className="flex items-center gap-1 px-3 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm whitespace-nowrap">
            <Plus className="w-4 h-4" /> Новий документ
          </button>
        )}
      </div>

      {/* Grid категорій з лічильниками */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <button onClick={() => setCatFilter('all')}
          className={`p-4 rounded-lg border text-left transition ${catFilter === 'all' ? 'border-rose-300 bg-rose-50/40 dark:bg-rose-500/10' : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:border-rose-300'}`}>
          <div className="text-xs uppercase tracking-wider text-stone-400 mb-1">Усе</div>
          <div className="text-2xl text-stone-800 dark:text-stone-100">{items.length}</div>
          <div className="text-xs text-stone-500 dark:text-stone-400">документ{items.length === 1 ? '' : items.length >= 2 && items.length <= 4 ? 'и' : 'ів'}</div>
        </button>
        {DOC_CATEGORIES.map((c) => {
          const list = byCategory[c.key] || [];
          const Icon = CAT_ICONS[c.iconName] || FileText;
          const on = catFilter === c.key;
          return (
            <button key={c.key} onClick={() => setCatFilter(c.key)}
              className={`p-4 rounded-lg border text-left transition ${on ? 'border-transparent text-white' : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:border-stone-300'}`}
              style={on ? { background: c.color } : undefined}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider opacity-80">{c.label}</span>
              </div>
              <div className="text-2xl">{list.length}</div>
            </button>
          );
        })}
      </div>

      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded mb-4">{error}</div>}

      {loading ? (
        <p className="text-sm text-stone-400 italic">Завантаження…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-stone-400 italic py-8 text-center">Документів у цій категорії немає</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {shown.map((d) => (
            <DocCard key={d.id} doc={d} onOpen={() => onOpenDoc(d)} canManage={canManage} onEdit={() => onEditDoc(d)} />
          ))}
        </div>
      )}
    </div>
  );
}

function DocCard({ doc, onOpen, canManage, onEdit }) {
  const c = docCategory(doc.category);
  const Icon = CAT_ICONS[c?.iconName] || FileText;
  const needsAttention = doc.isMandatory && (!doc.isRead || doc.needsReack);

  return (
    <div className={`rounded-lg border p-4 transition ${needsAttention ? 'border-rose-300 bg-rose-50/40 dark:bg-rose-500/10' : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900'}`}>
      <button onClick={onOpen} className="w-full text-left">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
            style={{ background: `${c?.color || '#78716c'}1a`, color: c?.color || '#78716c' }}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              {!doc.isPublished && <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300">Чернетка</span>}
              {doc.isMandatory && !doc.isRead && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500 text-white">❗ Потрібно прочитати</span>
              )}
              {doc.isMandatory && doc.needsReack && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-white">↻ Оновлено</span>
              )}
              {doc.isRead && !doc.needsReack && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 flex items-center gap-0.5">
                  <Check className="w-2.5 h-2.5" /> Прочитано
                </span>
              )}
              <span className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{ background: c?.color || '#78716c' }}>
                {c?.label || doc.category}
              </span>
            </div>
            <h3 className="text-base text-stone-800 dark:text-stone-100 leading-tight">{doc.title}</h3>
            {doc.description && (
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
                {doc.description}
              </p>
            )}
            <div className="text-xs text-stone-400 mt-1.5">
              v{doc.currentVersion} · оновлено {new Date(doc.updatedAt).toLocaleDateString('uk-UA')}
            </div>
          </div>
        </div>
      </button>
      {canManage && (
        <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800 flex justify-end gap-1">
          <button onClick={onEdit} className="text-xs px-2 py-1 rounded text-stone-600 dark:text-stone-300 hover:text-rose-600 flex items-center gap-1">
            <Edit3 className="w-3 h-3" /> Редагувати
          </button>
        </div>
      )}
    </div>
  );
}

// ============ ПЕРЕГЛЯД ДОКУМЕНТА ============
export function DocViewPage({ slug, onBack, onEdit, canManage }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tocOpen, setTocOpen] = useState(false); // mobile collapsible

  const load = () => {
    setLoading(true);
    apiGet(`/api/docs/${encodeURIComponent(slug)}`)
      .then(setDoc)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [slug]);

  const acknowledge = async () => {
    if (!doc) return;
    setBusy(true);
    try {
      await apiPost(`/api/docs/${doc.id}/acknowledge`, { versionAcknowledged: doc.currentVersion });
      load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (loading) return <p className="text-sm text-stone-400 italic">Завантаження…</p>;
  if (error) return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 mb-4 min-h-[44px]"><ArrowLeft className="w-4 h-4" /> Назад</button>
      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>
    </div>
  );
  if (!doc) return null;

  const c = docCategory(doc.category);
  const Icon = CAT_ICONS[c?.iconName] || FileText;

  // Дерево секцій з flat list по parentId
  const tree = buildSectionTree(doc.sections || []);

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 mb-4 min-h-[44px]">
        <ArrowLeft className="w-4 h-4" /> Повернутися
      </button>

      <div className="mb-6 pb-6 border-b border-stone-200 dark:border-stone-700">
        <div className="flex items-start gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${c?.color || '#78716c'}1a`, color: c?.color || '#78716c' }}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{ background: c?.color || '#78716c' }}>{c?.label || doc.category}</span>
              <span className="text-xs text-stone-400">v{doc.currentVersion}</span>
              {!doc.isPublished && <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300">Чернетка</span>}
              {doc.isMandatory && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500 text-white">Обов'язковий</span>}
            </div>
            <h1 className="text-2xl md:text-3xl text-stone-800 dark:text-stone-100">{doc.title}</h1>
            {doc.description && (
              <p className="text-stone-500 dark:text-stone-400 italic mt-1" style={{ fontFamily: 'system-ui, sans-serif' }}>{doc.description}</p>
            )}
          </div>
          {canManage && (
            <button onClick={onEdit} className="text-sm px-3 min-h-[40px] rounded-md border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:text-rose-600 hover:border-rose-300 flex items-center gap-1 flex-shrink-0">
              <Edit3 className="w-3.5 h-3.5" /> Редагувати
            </button>
          )}
        </div>
      </div>

      {/* Mobile TOC toggle */}
      {tree.length > 0 && (
        <div className="md:hidden mb-4">
          <button onClick={() => setTocOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 min-h-[44px] px-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md text-sm">
            <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> Зміст</span>
            <ChevronDown className={`w-4 h-4 transition ${tocOpen ? 'rotate-180' : ''}`} />
          </button>
          {tocOpen && (
            <div className="mt-2 p-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md max-h-72 overflow-y-auto">
              <TocTree tree={tree} />
            </div>
          )}
        </div>
      )}

      <div className="md:flex md:gap-6 md:items-start">
        {/* Desktop TOC */}
        {tree.length > 0 && (
          <aside className="hidden md:block w-64 flex-shrink-0 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
            <div className="text-xs uppercase tracking-wider text-stone-400 mb-2">Зміст</div>
            <TocTree tree={tree} />
          </aside>
        )}

        <div className="flex-1 min-w-0 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5 md:p-8">
          {tree.length === 0 ? (
            <p className="text-sm text-stone-400 italic">Документ ще не має жодної секції</p>
          ) : (
            tree.map((node) => <SectionNode key={node.id} node={node} />)
          )}

          {/* Кнопка ознайомлення */}
          {doc.isPublished && (
            <div className="mt-8 pt-6 border-t border-stone-200 dark:border-stone-700">
              {doc.needsReack ? (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded mb-3">
                  ⚠️ Документ оновлено (нова версія v{doc.currentVersion}). Будь ласка, повторно підтвердіть ознайомлення.
                </div>
              ) : null}
              {doc.isRead && !doc.needsReack ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded">
                  ✓ Ви ознайомилися з версією v{doc.lastAckVersion} {doc.lastAckAt && (
                    <>· {new Date(doc.lastAckAt).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })}</>
                  )}
                </div>
              ) : (
                <button onClick={acknowledge} disabled={busy}
                  className="w-full md:w-auto px-6 min-h-[48px] bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white rounded-md text-sm flex items-center justify-center gap-2"
                  style={{ fontFamily: 'system-ui, sans-serif' }}>
                  <Check className="w-4 h-4" />
                  {busy ? 'Збереження…' : `Я ознайомився з документом v${doc.currentVersion}`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildSectionTree(sections) {
  const byParent = {};
  sections.forEach((s) => {
    const k = s.parentId || 'ROOT';
    (byParent[k] = byParent[k] || []).push(s);
  });
  Object.values(byParent).forEach((arr) => arr.sort((a, b) => a.orderIdx - b.orderIdx));
  const build = (parentId) => (byParent[parentId || 'ROOT'] || []).map((s) => ({
    ...s, children: build(s.id),
  }));
  return build(null);
}

function TocTree({ tree }) {
  return (
    <ul className="space-y-1 text-sm" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {tree.map((node) => (
        <li key={node.id}>
          <a href={`#sec-${node.id}`} className="block py-1 text-stone-600 dark:text-stone-300 hover:text-rose-600 truncate">
            {node.title}
          </a>
          {node.children?.length > 0 && (
            <ul className="ml-3 mt-1 space-y-1 border-l border-stone-200 dark:border-stone-700 pl-2">
              {node.children.map((child) => (
                <li key={child.id}>
                  <a href={`#sec-${child.id}`} className="block py-0.5 text-xs text-stone-500 dark:text-stone-400 hover:text-rose-600 truncate">
                    {child.title}
                  </a>
                  {child.children?.length > 0 && (
                    <ul className="ml-3 mt-1 space-y-0.5">
                      {child.children.map((leaf) => (
                        <li key={leaf.id}>
                          <a href={`#sec-${leaf.id}`} className="block py-0.5 text-xs text-stone-400 hover:text-rose-600 truncate">· {leaf.title}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function SectionNode({ node }) {
  const Tag = node.level === 1 ? 'h2' : node.level === 2 ? 'h3' : 'h4';
  const headingCls = node.level === 1
    ? 'text-2xl mb-3 mt-8 first:mt-0 text-stone-800 dark:text-stone-100'
    : node.level === 2
      ? 'text-xl mb-2 mt-6 text-stone-800 dark:text-stone-100'
      : 'text-base mb-2 mt-4 text-stone-700 dark:text-stone-200';
  return (
    <section id={`sec-${node.id}`}>
      <Tag className={headingCls} style={{ fontFamily: 'Georgia, serif' }}>{node.title}</Tag>
      {node.body && (
        <div className="prose prose-stone dark:prose-invert max-w-none text-stone-700 dark:text-stone-200 break-words"
          style={{ fontFamily: 'system-ui, sans-serif', fontSize: '15px', lineHeight: '1.7' }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(node.body) }} />
      )}
      {node.children?.map((c) => <SectionNode key={c.id} node={c} />)}
    </section>
  );
}

// ============ РЕДАКТОР ДОКУМЕНТА ============
export function DocEditorPage({ slug, onBack, onSlugChange, allLocations = [], isAdmin }) {
  const confirm = useConfirm();
  const { roleKeys, roleName } = useRoles();
  const [doc, setDoc] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [meta, setMeta] = useState({ title: '', description: '', category: '', iconKey: '', color: '', mandatoryForRoles: [], mandatoryForLocations: [] });
  const [showHistory, setShowHistory] = useState(false);

  const load = () => {
    setLoading(true);
    apiGet(`/api/docs/${encodeURIComponent(slug)}`)
      .then((d) => {
        setDoc(d);
        setSections(d.sections || []);
        setMeta({
          title: d.title || '',
          description: d.description || '',
          category: d.category,
          iconKey: d.iconKey || '',
          color: d.color || '',
          mandatoryForRoles: d.mandatoryForRoles || [],
          mandatoryForLocations: d.mandatoryForLocations || [],
        });
        if (!activeId && (d.sections || []).length > 0) setActiveId(d.sections[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [slug]);

  const saveMeta = async () => {
    setError('');
    try {
      await apiPatch(`/api/docs/${doc.id}`, meta);
      load();
    } catch (e) { setError(e.message); }
  };

  const tree = useMemo(() => buildSectionTree(sections), [sections]);
  const active = sections.find((s) => s.id === activeId) || null;

  const addSection = async (parentId = null) => {
    try {
      const created = await apiPost(`/api/docs/${doc.id}/sections`, {
        parentId,
        title: 'Новий розділ',
        body: '',
        level: parentId ? 2 : 1,
      });
      setSections((prev) => [...prev, created]);
      setActiveId(created.id);
    } catch (e) { setError(e.message); }
  };

  const updateActive = (patch) => {
    setSections((prev) => prev.map((s) => s.id === activeId ? { ...s, ...patch } : s));
  };

  const saveActive = async () => {
    if (!active) return;
    try {
      await apiPatch(`/api/docs/sections/${active.id}`, { title: active.title, body: active.body });
    } catch (e) { setError(e.message); }
  };

  const removeSection = async (s) => {
    const ok = await confirm({ title: 'Видалити секцію?', description: s.title, confirmLabel: 'Видалити' });
    if (!ok) return;
    try {
      await apiDelete(`/api/docs/sections/${s.id}`);
      setSections((prev) => prev.filter((x) => x.id !== s.id && x.parentId !== s.id));
      if (activeId === s.id) setActiveId(null);
    } catch (e) { setError(e.message); }
  };

  const moveSection = async (s, dir) => {
    // Працює лише в межах того ж parentId
    const siblings = sections.filter((x) => (x.parentId || null) === (s.parentId || null))
      .sort((a, b) => a.orderIdx - b.orderIdx);
    const idx = siblings.findIndex((x) => x.id === s.id);
    if (idx < 0) return;
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= siblings.length) return;
    const swapped = siblings[targetIdx];
    const orders = [
      { id: s.id, orderIdx: targetIdx },
      { id: swapped.id, orderIdx: idx },
    ];
    setSections((prev) => prev.map((x) => {
      const o = orders.find((y) => y.id === x.id);
      return o ? { ...x, orderIdx: o.orderIdx } : x;
    }));
    try {
      await apiPost(`/api/docs/${doc.id}/sections/reorder`, { sectionOrders: orders });
    } catch (e) { setError(e.message); }
  };

  const publish = async () => {
    try {
      await apiPost(`/api/docs/${doc.id}/publish`);
      load();
    } catch (e) { setError(e.message); }
  };
  const unpublish = async () => {
    const ok = await confirm({ title: 'Зняти з публікації?', description: 'Юзери більше не побачать документ', confirmLabel: 'Зняти' });
    if (!ok) return;
    try {
      await apiPost(`/api/docs/${doc.id}/unpublish`);
      load();
    } catch (e) { setError(e.message); }
  };
  const newVersion = async () => {
    const note = window.prompt('Опис змін (опціонально)') || '';
    try {
      await apiPost(`/api/docs/${doc.id}/version`, { changeNote: note });
      load();
    } catch (e) { setError(e.message); }
  };

  const removeDoc = async () => {
    const ok = await confirm({ title: 'Видалити документ?', description: 'Назавжди разом з усіма версіями та підтвердженнями', confirmLabel: 'Видалити' });
    if (!ok) return;
    try {
      await apiDelete(`/api/docs/${doc.id}`);
      onBack?.();
    } catch (e) { setError(e.message); }
  };

  if (loading) return <p className="text-sm text-stone-400 italic">Завантаження…</p>;
  if (error && !doc) return <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>;
  if (!doc) return null;

  const toggleRole = (rk) => setMeta((p) => ({ ...p, mandatoryForRoles: p.mandatoryForRoles.includes(rk) ? p.mandatoryForRoles.filter((x) => x !== rk) : [...p.mandatoryForRoles, rk] }));
  const toggleLoc = (id) => setMeta((p) => ({ ...p, mandatoryForLocations: p.mandatoryForLocations.includes(id) ? p.mandatoryForLocations.filter((x) => x !== id) : [...p.mandatoryForLocations, id] }));

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 mb-4 min-h-[44px]">
        <ArrowLeft className="w-4 h-4" /> Повернутися
      </button>

      <div className="mb-4 pb-4 border-b border-stone-200 dark:border-stone-700 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Редагування</p>
          <h1 className="text-xl md:text-2xl text-stone-800 dark:text-stone-100">{meta.title || 'Без назви'}</h1>
          <div className="text-xs text-stone-400 mt-0.5">
            v{doc.currentVersion} · {doc.isPublished ? <span className="text-emerald-600">опубліковано</span> : <span className="text-stone-500">чернетка</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowHistory(true)}
            className="px-3 min-h-[40px] rounded-md text-sm border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:text-rose-600 flex items-center gap-1">
            <History className="w-4 h-4" /> Історія версій
          </button>
          {doc.isPublished && (
            <button onClick={newVersion}
              className="px-3 min-h-[40px] rounded-md text-sm bg-amber-500 hover:bg-amber-600 text-white">
              Створити нову версію
            </button>
          )}
          {doc.isPublished ? (
            <button onClick={unpublish}
              className="px-3 min-h-[40px] rounded-md text-sm bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-200 flex items-center gap-1">
              <EyeOff className="w-4 h-4" /> Зняти з публікації
            </button>
          ) : (
            <button onClick={publish}
              className="px-3 min-h-[40px] rounded-md text-sm bg-rose-500 hover:bg-rose-600 text-white flex items-center gap-1">
              <Eye className="w-4 h-4" /> Опублікувати
            </button>
          )}
          {isAdmin && (
            <button onClick={removeDoc}
              className="px-3 min-h-[40px] rounded-md text-sm border border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center gap-1">
              <Trash2 className="w-4 h-4" /> Видалити
            </button>
          )}
        </div>
      </div>

      {error && <div className="p-2 mb-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">{error}</div>}

      {/* Мета-дані */}
      <details className="mb-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <summary className="p-3 text-sm text-stone-700 dark:text-stone-200 cursor-pointer flex items-center gap-2">
          <Edit3 className="w-4 h-4" /> Метадані документа
        </summary>
        <div className="p-4 border-t border-stone-200 dark:border-stone-700 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Назва</span>
              <input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Опис</span>
              <input value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })}
                className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
            </label>
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Категорія</span>
            <div className="flex flex-wrap gap-2">
              {DOC_CATEGORIES.map((c) => {
                const Icon = CAT_ICONS[c.iconName] || FileText;
                const on = meta.category === c.key;
                return (
                  <button key={c.key} type="button" onClick={() => setMeta({ ...meta, category: c.key })}
                    className={`px-3 min-h-[40px] rounded-full text-sm border transition flex items-center gap-1.5 ${on ? 'text-white border-transparent' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}
                    style={on ? { background: c.color } : undefined}>
                    <Icon className="w-4 h-4" />{c.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Обов'язковий для ролей</span>
            <div className="flex flex-wrap gap-1.5">
              {roleKeys.map((rk) => {
                const on = meta.mandatoryForRoles.includes(rk);
                return (
                  <button key={rk} type="button" onClick={() => toggleRole(rk)}
                    className={`px-3 py-1 rounded-full text-xs border ${on ? 'bg-rose-500 text-white border-rose-500' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}>
                    {roleName(rk)}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Обов'язковий для локацій</span>
            <div className="flex flex-wrap gap-1.5">
              {allLocations.map((l) => {
                const on = meta.mandatoryForLocations.includes(l.id);
                return (
                  <button key={l.id} type="button" onClick={() => toggleLoc(l.id)}
                    className={`px-3 py-1 rounded-full text-xs border ${on ? 'text-white border-transparent' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}
                    style={on ? { background: l.color || '#a8a29e' } : undefined}>
                    {l.name}
                  </button>
                );
              })}
            </div>
            {meta.mandatoryForRoles.length === 0 && meta.mandatoryForLocations.length === 0 && (
              <p className="text-xs text-stone-400 italic mt-2">Документ буде інформаційним (не обов'язковим). Виберіть ролі або локації, щоб зробити обов'язковим.</p>
            )}
          </div>
          <button onClick={saveMeta} className="px-4 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm">
            Зберегти метадані
          </button>
        </div>
      </details>

      <div className="md:flex md:gap-6 md:items-start">
        {/* Дерево секцій */}
        <aside className="md:w-72 flex-shrink-0 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-3 mb-4 md:mb-0 md:sticky md:top-24 md:max-h-[calc(100vh-7rem)] md:overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wider text-stone-400">Структура</div>
            <button onClick={() => addSection(null)} className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Розділ
            </button>
          </div>
          {tree.length === 0 ? (
            <p className="text-xs text-stone-400 italic py-2">Ще немає розділів</p>
          ) : (
            <TreeEdit tree={tree} activeId={activeId} onSelect={setActiveId}
              onAddChild={addSection} onMove={moveSection} onRemove={removeSection} />
          )}
        </aside>

        {/* Редактор секції */}
        <div className="flex-1 min-w-0 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-4">
          {!active ? (
            <p className="text-sm text-stone-400 italic">Оберіть або створіть розділ зліва</p>
          ) : (
            <div className="space-y-3" style={{ fontFamily: 'system-ui, sans-serif' }}>
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Назва розділу (рівень {active.level})</label>
                <input value={active.title} onChange={(e) => updateActive({ title: e.target.value })} onBlur={saveActive}
                  className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Текст (markdown)</label>
                <MarkdownEditor value={active.body || ''} onChange={(v) => updateActive({ body: v })} placeholder="Текст розділу. Markdown підтримується (тулбар вище)." />
                <button onClick={saveActive} className="mt-2 px-3 min-h-[40px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm">
                  Зберегти текст
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showHistory && (
        <VersionsModal docId={doc.id} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}

function TreeEdit({ tree, activeId, onSelect, onAddChild, onMove, onRemove, depth = 0 }) {
  return (
    <ul className={depth === 0 ? 'space-y-0.5' : 'mt-1 space-y-0.5 border-l border-stone-200 dark:border-stone-700 pl-2'}>
      {tree.map((node, idx) => (
        <li key={node.id}>
          <div className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${activeId === node.id ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800'}`}>
            <button onClick={() => onSelect(node.id)} className="flex-1 text-left truncate">
              {node.title || '(без назви)'}
            </button>
            <button onClick={() => onMove(node, 'up')} disabled={idx === 0}
              className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 disabled:opacity-30">
              <ArrowUp className="w-3 h-3" />
            </button>
            <button onClick={() => onMove(node, 'down')} disabled={idx === tree.length - 1}
              className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 disabled:opacity-30">
              <ArrowDown className="w-3 h-3" />
            </button>
            {node.level < 3 && (
              <button onClick={() => onAddChild(node.id)}
                className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-rose-600" title="Додати підпункт">
                <Plus className="w-3 h-3" />
              </button>
            )}
            <button onClick={() => onRemove(node)}
              className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-rose-600" title="Видалити">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          {node.children?.length > 0 && (
            <TreeEdit tree={node.children} activeId={activeId} onSelect={onSelect}
              onAddChild={onAddChild} onMove={onMove} onRemove={onRemove} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

function VersionsModal({ docId, onClose }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiGet(`/api/docs/${docId}/versions`).then((d) => setVersions(Array.isArray(d) ? d : [])).finally(() => setLoading(false));
  }, [docId]);
  return (
    <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-stretch md:items-center justify-center md:p-4">
      <div className="bg-white dark:bg-stone-900 w-full h-full md:h-auto md:max-w-lg md:max-h-[80vh] rounded-none md:rounded-lg flex flex-col">
        <div className="p-4 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
          <h3 className="text-lg text-stone-800 dark:text-stone-100">Історія версій</h3>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-stone-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4" style={{ fontFamily: 'system-ui, sans-serif' }}>
          {loading ? <p className="text-sm text-stone-400 italic">Завантаження…</p>
            : versions.length === 0 ? <p className="text-sm text-stone-400 italic">Версій ще немає</p>
            : versions.map((v) => (
              <div key={v.id} className="py-3 border-b border-stone-100 dark:border-stone-800 last:border-0">
                <div className="text-sm text-stone-800 dark:text-stone-100">Версія v{v.version}</div>
                <div className="text-xs text-stone-400">
                  {new Date(v.createdAt).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })}
                  {v.changedByName && <> · {v.changedByName}</>}
                </div>
                {v.changeNote && <div className="text-xs text-stone-500 dark:text-stone-400 mt-1 italic">{v.changeNote}</div>}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ============ СТВОРЕННЯ НОВОГО ДОКУМЕНТА ============
export function NewDocPage({ onBack, onCreated }) {
  const [form, setForm] = useState({ slug: '', title: '', description: '', category: 'conduct' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9-\s]/g, '').replace(/\s+/g, '-');

  const save = async () => {
    setError('');
    const slug = form.slug || slugify(form.title);
    if (!slug || !form.title.trim()) return setError('Заповніть назву');
    setBusy(true);
    try {
      const doc = await apiPost('/api/docs', { ...form, slug });
      onCreated?.(doc);
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <div className="max-w-2xl">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 mb-4 min-h-[44px]">
        <ArrowLeft className="w-4 h-4" /> Назад
      </button>
      <h1 className="text-2xl text-stone-800 dark:text-stone-100 mb-4">Новий документ</h1>
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5 space-y-3" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Назва</span>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Slug (URL)</span>
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder={slugify(form.title) || 'rules-of-conduct'}
            className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Опис</span>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
        </label>
        <div>
          <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Категорія</span>
          <div className="flex flex-wrap gap-2">
            {DOC_CATEGORIES.map((c) => {
              const Icon = CAT_ICONS[c.iconName] || FileText;
              const on = form.category === c.key;
              return (
                <button key={c.key} type="button" onClick={() => setForm({ ...form, category: c.key })}
                  className={`px-3 min-h-[40px] rounded-full text-sm border flex items-center gap-1.5 ${on ? 'text-white border-transparent' : 'text-stone-600 dark:text-stone-300 border-stone-300'}`}
                  style={on ? { background: c.color } : undefined}>
                  <Icon className="w-4 h-4" />{c.label}
                </button>
              );
            })}
          </div>
        </div>
        {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
        <button onClick={save} disabled={busy} className="px-4 min-h-[44px] bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white rounded-md text-sm">
          {busy ? 'Створення…' : 'Створити'}
        </button>
      </div>
    </div>
  );
}
