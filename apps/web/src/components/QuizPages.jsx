import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft, Clock, Check, X, AlertCircle, ChevronRight, ChevronDown,
  Plus, Trash2, ArrowUp, ArrowDown, Edit3, RotateCcw, Award, FileText,
} from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api';
import { useConfirm } from './ConfirmDialog';
import { renderMarkdown } from '../markdown';

const QUESTION_TYPE_LABELS = {
  single: 'Один варіант',
  multi: 'Кілька варіантів',
  text: 'Текстова відповідь',
};

const formatTime = (sec) => {
  if (sec == null || sec < 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// ============ ГРАВЕЦЬ (юзер проходить тест) ============
export function QuizPlayerPage({ quizId, onBack, onFinish }) {
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    apiPost(`/api/quizzes/${quizId}/start`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [quizId]);

  // Тикер для countdown
  useEffect(() => {
    if (!data?.timeLimit) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [data?.timeLimit]);

  const elapsedSec = data ? Math.floor((now - data.startedAt) / 1000) : 0;
  const remainingSec = data?.timeLimit ? Math.max(0, data.timeLimit - elapsedSec) : null;

  const submit = async (force = false) => {
    if (busy || !data) return;
    if (!force) {
      const total = data.questions.length;
      const answered = Object.keys(answers).filter((k) => {
        const v = answers[k];
        if (Array.isArray(v)) return v.length > 0;
        return v !== undefined && v !== '';
      }).length;
      if (answered < total) {
        if (!window.confirm(`Відповідей: ${answered} з ${total}. Все одно завершити?`)) return;
      }
    }
    setBusy(true);
    try {
      const payload = {
        answers: Object.entries(answers).map(([qid, ans]) => ({ questionId: qid, answer: ans })),
      };
      const r = await apiPost(`/api/quizzes/attempts/${data.attemptId}/submit`, payload);
      onFinish?.(data.attemptId, r);
    } catch (e) { setError(e.message); setBusy(false); }
  };

  // Авто-сабміт при вичерпанні часу
  useEffect(() => {
    if (data?.timeLimit && remainingSec === 0 && !busy) submit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSec, data?.timeLimit]);

  if (error) return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 mb-4 min-h-[44px]"><ArrowLeft className="w-4 h-4" /> Назад</button>
      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>
    </div>
  );
  if (!data) return <p className="text-sm text-stone-400 italic">Завантаження тесту…</p>;

  const answeredCount = Object.keys(answers).filter((k) => {
    const v = answers[k];
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== '';
  }).length;

  return (
    <div>
      <div className="sticky top-[60px] md:top-[68px] z-30 bg-stone-50/95 dark:bg-stone-950/95 backdrop-blur -mx-4 px-4 md:-mx-6 md:px-6 py-3 mb-4 border-b border-stone-200 dark:border-stone-700">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-stone-400">Тест</div>
            <div className="text-base md:text-lg text-stone-800 dark:text-stone-100 truncate">{data.quiz.title}</div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {remainingSec !== null && (
              <div className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm ${remainingSec < 60 ? 'bg-rose-500 text-white' : 'bg-amber-100 text-amber-800'}`}>
                <Clock className="w-4 h-4" /> {formatTime(remainingSec)}
              </div>
            )}
            <div className="text-xs text-stone-500 dark:text-stone-400 hidden sm:block">
              Відповіді: {answeredCount} / {data.questions.length}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {data.questions.map((q, idx) => (
          <QuestionCard key={q.id} q={q} idx={idx} answer={answers[q.id]}
            onChange={(v) => setAnswers((p) => ({ ...p, [q.id]: v }))} />
        ))}
      </div>

      <div className="mt-6 sticky bottom-0 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-700 -mx-4 px-4 md:-mx-6 md:px-6 py-3 flex justify-between items-center gap-3">
        <span className="text-xs text-stone-500 dark:text-stone-400">
          Відповіді: {answeredCount} / {data.questions.length}
        </span>
        <button onClick={() => submit(false)} disabled={busy}
          className="px-5 min-h-[44px] bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white rounded-md text-sm flex items-center gap-2"
          style={{ fontFamily: 'system-ui, sans-serif' }}>
          {busy ? 'Збереження…' : <>Завершити тест <ChevronRight className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  );
}

function QuestionCard({ q, idx, answer, onChange }) {
  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5">
      <div className="text-xs uppercase tracking-wider text-stone-400 mb-1">Питання {idx + 1} · {QUESTION_TYPE_LABELS[q.type]} · {q.points} б.</div>
      <div className="text-base text-stone-800 dark:text-stone-100 mb-3 break-words" style={{ fontFamily: 'system-ui, sans-serif' }}>{q.text}</div>
      {q.type === 'single' && (
        <div className="space-y-1.5">
          {(q.options || []).map((o) => (
            <label key={o.id} className={`flex items-start gap-2 p-3 rounded border cursor-pointer min-h-[44px] ${answer === o.id ? 'border-rose-300 bg-rose-50 dark:bg-rose-500/15' : 'border-stone-200 dark:border-stone-700'}`}>
              <input type="radio" name={`q-${q.id}`} checked={answer === o.id} onChange={() => onChange(o.id)}
                className="mt-1 w-5 h-5 accent-rose-500" />
              <span className="text-sm text-stone-700 dark:text-stone-200" style={{ fontFamily: 'system-ui, sans-serif' }}>{o.text}</span>
            </label>
          ))}
        </div>
      )}
      {q.type === 'multi' && (
        <div className="space-y-1.5">
          {(q.options || []).map((o) => {
            const on = Array.isArray(answer) && answer.includes(o.id);
            return (
              <label key={o.id} className={`flex items-start gap-2 p-2 rounded border cursor-pointer ${on ? 'border-rose-300 bg-rose-50 dark:bg-rose-500/15' : 'border-stone-200 dark:border-stone-700'}`}>
                <input type="checkbox" checked={on}
                  onChange={() => onChange(on ? (answer || []).filter((x) => x !== o.id) : [...(answer || []), o.id])}
                  className="mt-1 w-5 h-5 accent-rose-500" />
                <span className="text-sm text-stone-700 dark:text-stone-200" style={{ fontFamily: 'system-ui, sans-serif' }}>{o.text}</span>
              </label>
            );
          })}
        </div>
      )}
      {q.type === 'text' && (
        <textarea value={answer || ''} onChange={(e) => onChange(e.target.value)}
          placeholder="Ваша відповідь" rows={4}
          className="w-full p-3 min-h-[100px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-stone-800 dark:text-stone-100 placeholder:text-stone-400 text-sm"
          style={{ fontFamily: 'system-ui, sans-serif' }} />
      )}
    </div>
  );
}

// ============ РЕЗУЛЬТАТ ============
export function AttemptResultPage({ attemptId, onBack, onRetry, onBackToCourse }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet(`/api/quizzes/attempts/${attemptId}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [attemptId]);

  if (error) return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 mb-4 min-h-[44px]"><ArrowLeft className="w-4 h-4" /> Назад</button>
      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>
    </div>
  );
  if (!data) return <p className="text-sm text-stone-400 italic">Завантаження…</p>;

  const score = data.score ?? 0;
  const passed = !!data.passed;
  const passingScore = data.quiz.passingScore;
  const totalQ = (data.answers || []).length;
  const correctQ = (data.answers || []).filter((a) => a.isCorrect).length;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 mb-4 min-h-[44px]">
        <ArrowLeft className="w-4 h-4" /> Назад
      </button>

      <div className="text-center mb-8">
        <div className="text-xs uppercase tracking-wider text-stone-400 mb-1">Результат тесту</div>
        <div className="text-stone-700 dark:text-stone-200 mb-4" style={{ fontFamily: 'Georgia, serif' }}>{data.quiz.title}</div>
        <div className={`mx-auto w-32 h-32 rounded-full flex items-center justify-center text-4xl text-white mb-3 ${passed ? 'bg-emerald-500' : 'bg-rose-500'}`}>
          {score}%
        </div>
        <div className={`text-xl mb-1 ${passed ? 'text-emerald-700' : 'text-rose-700'}`}>
          {passed ? '🎉 Пройдено!' : 'Не пройдено'}
        </div>
        <div className="text-sm text-stone-500 dark:text-stone-400">
          Прохідний бал: {passingScore}% · Правильних відповідей: {correctQ} з {totalQ}
        </div>
      </div>

      <div className="flex justify-center gap-2 mb-6">
        {onBackToCourse && (
          <button onClick={onBackToCourse}
            className="px-4 min-h-[44px] bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 rounded-md text-sm flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> До курсу
          </button>
        )}
        {!passed && onRetry && (
          <button onClick={onRetry}
            className="px-4 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm flex items-center gap-1">
            <RotateCcw className="w-4 h-4" /> Повторити спробу
          </button>
        )}
      </div>

      {(data.quiz.showCorrectAnswers || data.answers?.some((a) => a.question?.correctAnswer)) && (
        <div className="space-y-3">
          <h2 className="text-sm uppercase tracking-wider text-stone-400 mb-2">Перегляд відповідей</h2>
          {(data.answers || []).map((a, idx) => (
            <AnswerReviewCard key={a.questionId} a={a} idx={idx} />
          ))}
        </div>
      )}
    </div>
  );
}

function AnswerReviewCard({ a, idx }) {
  const q = a.question;
  if (!q) return null;
  const correctIds = (q.options || []).filter((o) => o.isCorrect).map((o) => o.id);
  return (
    <div className={`rounded-lg border p-4 ${a.isCorrect ? 'border-emerald-200 bg-emerald-50/40 dark:bg-emerald-500/5' : 'border-rose-200 bg-rose-50/40 dark:bg-rose-500/5'}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${a.isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`}>
          {a.isCorrect ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
        </div>
        <span className="text-xs uppercase tracking-wider text-stone-400">Питання {idx + 1} · {a.pointsEarned}/{q.points} б.</span>
      </div>
      <div className="text-sm text-stone-800 dark:text-stone-100 mb-2" style={{ fontFamily: 'system-ui, sans-serif' }}>{q.text}</div>

      {q.type === 'single' && (
        <div className="space-y-1 text-sm">
          {(q.options || []).map((o) => {
            const isMine = a.answer === o.id;
            const isCorrect = correctIds.includes(o.id);
            return (
              <div key={o.id} className={`flex items-center gap-2 p-2 rounded ${isCorrect ? 'bg-emerald-100/50 text-emerald-800' : isMine ? 'bg-rose-100/50 text-rose-800' : 'text-stone-600 dark:text-stone-300'}`}>
                {isCorrect && <Check className="w-3 h-3 text-emerald-600" />}
                {isMine && !isCorrect && <X className="w-3 h-3 text-rose-600" />}
                {!isMine && !isCorrect && <span className="w-3 h-3" />}
                <span>{o.text}{isMine ? ' (ваша)' : ''}</span>
              </div>
            );
          })}
        </div>
      )}
      {q.type === 'multi' && (
        <div className="space-y-1 text-sm">
          {(q.options || []).map((o) => {
            const isMine = Array.isArray(a.answer) && a.answer.includes(o.id);
            const isCorrect = correctIds.includes(o.id);
            return (
              <div key={o.id} className={`flex items-center gap-2 p-2 rounded ${isCorrect ? 'bg-emerald-100/50 text-emerald-800' : isMine ? 'bg-rose-100/50 text-rose-800' : 'text-stone-600 dark:text-stone-300'}`}>
                {isCorrect && <Check className="w-3 h-3 text-emerald-600" />}
                {isMine && !isCorrect && <X className="w-3 h-3 text-rose-600" />}
                {!isMine && !isCorrect && <span className="w-3 h-3" />}
                <span>{o.text}{isMine ? ' (ваша)' : ''}</span>
              </div>
            );
          })}
        </div>
      )}
      {q.type === 'text' && (
        <div className="space-y-1 text-sm">
          <div className="text-stone-700 dark:text-stone-200">
            <span className="text-stone-400">Ваша: </span>
            <span>{a.answer || '—'}</span>
          </div>
          {q.correctAnswer && (
            <div className="text-emerald-700">
              <span className="text-stone-400">Очікувалось: </span>
              <span>{q.correctAnswer}</span>
            </div>
          )}
        </div>
      )}
      {q.explanation && (
        <div className="mt-3 pt-2 border-t border-stone-200 dark:border-stone-700 text-xs text-stone-500 dark:text-stone-400 italic">
          💡 {q.explanation}
        </div>
      )}
    </div>
  );
}

// ============ РЕДАКТОР QUIZ (admin/hr) ============
export function QuizEditorPage({ quizId, onBack }) {
  const confirm = useConfirm();
  const [quiz, setQuiz] = useState(null);
  const [meta, setMeta] = useState(null);
  const [editingQ, setEditingQ] = useState(null); // null | 'new' | obj
  const [error, setError] = useState('');

  const load = () => {
    apiGet(`/api/quizzes/${quizId}/preview`)
      .then((q) => {
        setQuiz(q);
        setMeta({
          title: q.title,
          description: q.description || '',
          passingScore: q.passingScore,
          maxAttempts: q.maxAttempts,
          timeLimit: q.timeLimit || '',
          shuffleQuestions: q.shuffleQuestions,
          showCorrectAnswers: q.showCorrectAnswers,
        });
      })
      .catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, [quizId]);

  const saveMeta = async () => {
    try {
      await apiPatch(`/api/quizzes/${quizId}`, {
        ...meta,
        timeLimit: meta.timeLimit === '' ? null : meta.timeLimit,
      });
      load();
    } catch (e) { setError(e.message); }
  };

  const removeQ = async (q) => {
    const ok = await confirm({ title: 'Видалити питання?', description: q.text.slice(0, 80), confirmLabel: 'Видалити' });
    if (!ok) return;
    await apiDelete(`/api/quizzes/questions/${q.id}`).catch((e) => setError(e.message));
    load();
  };

  const move = async (q, dir) => {
    const list = [...(quiz.questions || [])].sort((a, b) => a.orderIdx - b.orderIdx);
    const idx = list.findIndex((x) => x.id === q.id);
    const tgt = dir === 'up' ? idx - 1 : idx + 1;
    if (tgt < 0 || tgt >= list.length) return;
    await apiPost(`/api/quizzes/${quizId}/questions/reorder`, {
      orders: [{ id: list[idx].id, orderIdx: tgt }, { id: list[tgt].id, orderIdx: idx }],
    });
    load();
  };

  if (error && !quiz) return <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>;
  if (!quiz || !meta) return <p className="text-sm text-stone-400 italic">Завантаження…</p>;

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 mb-4 min-h-[44px]">
        <ArrowLeft className="w-4 h-4" /> Повернутися
      </button>

      <div className="mb-4 pb-4 border-b border-stone-200 dark:border-stone-700">
        <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Редагування тесту</p>
        <h1 className="text-xl md:text-2xl text-stone-800 dark:text-stone-100">{meta.title}</h1>
      </div>

      {error && <div className="p-2 mb-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">{error}</div>}

      {/* Метадані */}
      <details className="mb-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg" style={{ fontFamily: 'system-ui, sans-serif' }} open>
        <summary className="p-3 text-sm text-stone-700 dark:text-stone-200 cursor-pointer flex items-center gap-2">
          <Edit3 className="w-4 h-4" /> Налаштування
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
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Прохідний бал, %</span>
              <input type="number" min={0} max={100} value={meta.passingScore} onChange={(e) => setMeta({ ...meta, passingScore: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Макс. спроб</span>
              <input type="number" min={1} value={meta.maxAttempts} onChange={(e) => setMeta({ ...meta, maxAttempts: parseInt(e.target.value, 10) || 1 })}
                className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Час, сек (опц.)</span>
              <input type="number" value={meta.timeLimit} onChange={(e) => setMeta({ ...meta, timeLimit: e.target.value })}
                placeholder="без обмеження"
                className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200">
            <input type="checkbox" checked={meta.shuffleQuestions} onChange={(e) => setMeta({ ...meta, shuffleQuestions: e.target.checked })}
              className="w-4 h-4 accent-rose-500" />
            Перемішувати питання
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200">
            <input type="checkbox" checked={meta.showCorrectAnswers} onChange={(e) => setMeta({ ...meta, showCorrectAnswers: e.target.checked })}
              className="w-4 h-4 accent-rose-500" />
            Показувати правильні відповіді після завершення
          </label>
          <button onClick={saveMeta} className="px-4 min-h-[44px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm">
            Зберегти налаштування
          </button>
        </div>
      </details>

      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm uppercase tracking-wider text-stone-500 dark:text-stone-400">Питання ({(quiz.questions || []).length})</h3>
          <button onClick={() => setEditingQ('new')} className="flex items-center gap-1 px-3 min-h-[40px] bg-rose-500 hover:bg-rose-600 text-white rounded-md text-sm">
            <Plus className="w-4 h-4" /> Питання
          </button>
        </div>
        {(quiz.questions || []).length === 0 ? (
          <p className="text-sm text-stone-400 italic py-4 text-center">Питань ще немає</p>
        ) : (
          <ul className="space-y-2">
            {[...(quiz.questions || [])].sort((a, b) => a.orderIdx - b.orderIdx).map((q, idx, arr) => (
              <li key={q.id} className="p-3 border border-stone-200 dark:border-stone-700 rounded flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-wider text-stone-400 mb-0.5">
                    Питання {idx + 1} · {QUESTION_TYPE_LABELS[q.type]} · {q.points} б.
                  </div>
                  <div className="text-sm text-stone-800 dark:text-stone-100 mb-1" style={{ fontFamily: 'system-ui, sans-serif' }}>{q.text}</div>
                  {(q.type === 'single' || q.type === 'multi') && (
                    <div className="text-xs text-stone-500 dark:text-stone-400 flex flex-wrap gap-1.5">
                      {(q.options || []).map((o) => (
                        <span key={o.id} className={`px-1.5 py-0.5 rounded ${o.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 dark:bg-stone-800'}`}>
                          {o.text}{o.isCorrect && ' ✓'}
                        </span>
                      ))}
                    </div>
                  )}
                  {q.type === 'text' && q.correctAnswer && (
                    <div className="text-xs text-stone-500 dark:text-stone-400">Очікувано: <code>{q.correctAnswer}</code></div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => move(q, 'up')} disabled={idx === 0} className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
                  <button onClick={() => move(q, 'down')} disabled={idx === arr.length - 1} className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
                  <button onClick={() => setEditingQ(q)} className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-rose-600"><Edit3 className="w-3 h-3" /></button>
                  <button onClick={() => removeQ(q)} className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-rose-600"><Trash2 className="w-3 h-3" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editingQ && (
        <QuestionEditorModal
          quizId={quizId}
          question={editingQ === 'new' ? null : editingQ}
          onClose={() => setEditingQ(null)}
          onSaved={() => { setEditingQ(null); load(); }}
        />
      )}
    </div>
  );
}

function QuestionEditorModal({ quizId, question, onClose, onSaved }) {
  const isEdit = !!question?.id;
  const [form, setForm] = useState(() => ({
    type: question?.type || 'single',
    text: question?.text || '',
    explanation: question?.explanation || '',
    points: question?.points || 1,
    options: question?.options || [
      { id: `opt_${Date.now()}_1`, text: '', isCorrect: false },
      { id: `opt_${Date.now()}_2`, text: '', isCorrect: false },
    ],
    correctAnswer: question?.correctAnswer || '',
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const addOption = () => setForm((p) => ({ ...p, options: [...p.options, { id: `opt_${Date.now()}_${p.options.length}`, text: '', isCorrect: false }] }));
  const removeOption = (i) => setForm((p) => ({ ...p, options: p.options.filter((_, j) => j !== i) }));
  const updateOption = (i, patch) => setForm((p) => ({ ...p, options: p.options.map((o, j) => j === i ? { ...o, ...patch } : o) }));

  const save = async () => {
    setError('');
    if (!form.text.trim()) return setError('Введіть текст питання');
    if (form.type !== 'text') {
      const filled = form.options.filter((o) => o.text.trim());
      if (filled.length < 2) return setError('Мінімум 2 опції');
      if (!filled.some((o) => o.isCorrect)) return setError('Позначте хоча б одну правильну опцію');
    }
    if (form.type === 'text' && !form.correctAnswer.trim()) return setError('Введіть очікувану відповідь');

    setBusy(true);
    const payload = {
      type: form.type,
      text: form.text,
      explanation: form.explanation || null,
      points: form.points,
      options: form.type !== 'text' ? form.options.filter((o) => o.text.trim()) : null,
      correctAnswer: form.type === 'text' ? form.correctAnswer : null,
    };
    try {
      if (isEdit) await apiPatch(`/api/quizzes/questions/${question.id}`, payload);
      else await apiPost(`/api/quizzes/${quizId}/questions`, payload);
      onSaved?.();
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-stretch md:items-center justify-center md:p-4">
      <div className="bg-white dark:bg-stone-900 w-full h-full md:h-auto md:max-w-xl md:max-h-[90vh] rounded-none md:rounded-lg flex flex-col overflow-hidden">
        <div className="p-4 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
          <h3 className="text-lg text-stone-800 dark:text-stone-100">{isEdit ? 'Редагування питання' : 'Нове питання'}</h3>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-stone-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <div>
            <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Тип</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm">
              <option value="single">Один варіант (single)</option>
              <option value="multi">Кілька варіантів (multi)</option>
              <option value="text">Текстова відповідь (text)</option>
            </select>
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Текст питання</span>
            <textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} rows={3}
              className="w-full p-3 border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Бали</span>
            <input type="number" min={1} value={form.points} onChange={(e) => setForm({ ...form, points: parseInt(e.target.value, 10) || 1 })}
              className="w-32 px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
          </div>

          {(form.type === 'single' || form.type === 'multi') && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">Опції</span>
                <button onClick={addOption} className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Опція
                </button>
              </div>
              <div className="space-y-2">
                {form.options.map((o, i) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <input type={form.type === 'single' ? 'radio' : 'checkbox'} name="correct-opt"
                      checked={!!o.isCorrect}
                      onChange={() => {
                        if (form.type === 'single') {
                          setForm((p) => ({ ...p, options: p.options.map((x, j) => ({ ...x, isCorrect: i === j })) }));
                        } else {
                          updateOption(i, { isCorrect: !o.isCorrect });
                        }
                      }}
                      className="w-4 h-4 accent-rose-500" />
                    <input value={o.text} onChange={(e) => updateOption(i, { text: e.target.value })}
                      placeholder={`Опція ${i + 1}`}
                      className="flex-1 px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
                    <button onClick={() => removeOption(i)} disabled={form.options.length <= 2}
                      className="w-9 h-9 flex items-center justify-center text-stone-400 hover:text-rose-600 disabled:opacity-30">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {form.type === 'text' && (
            <div>
              <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Очікувана відповідь</span>
              <input value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
                placeholder="Точне співпадіння (case-insensitive). Або /regex/i"
                className="w-full px-3 min-h-[44px] border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
              <p className="text-xs text-stone-400 italic mt-1">Підтримка regex: <code>/^(odeka|odek)$/i</code></p>
            </div>
          )}

          <div>
            <span className="block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Пояснення (опц.)</span>
            <textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} rows={2}
              placeholder="Показується після завершення спроби"
              className="w-full p-3 border border-stone-200 dark:border-stone-700 rounded-md bg-transparent text-sm" />
          </div>

          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">{error}</div>}
        </div>
        <div className="p-4 border-t border-stone-200 dark:border-stone-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 min-h-[44px] bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 rounded-md text-sm">Скасувати</button>
          <button onClick={save} disabled={busy} className="px-4 min-h-[44px] bg-rose-500 disabled:opacity-60 text-white rounded-md text-sm">
            {busy ? 'Збереження…' : isEdit ? 'Зберегти' : 'Додати питання'}
          </button>
        </div>
      </div>
    </div>
  );
}
