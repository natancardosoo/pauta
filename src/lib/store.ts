import { useCallback, useEffect, useRef, useState } from "react";

/** Uma lista: Trabalho, Retake, Pessoal... */
export type Context = {
  id: string;
  name: string;
  color: string;
  order: number;
};

export type ChecklistItem = { id: string; text: string; done: boolean };

export type Tag = { id: string; name: string; color: string };

export type Task = {
  id: string;
  title: string;
  /** null = ainda na Entrada (sem lista) */
  contextId: string | null;
  /** Data no formato YYYY-MM-DD */
  due: string | null;
  requester: string;
  notes: string;
  checklist: ChecklistItem[];
  tagIds: string[];
  done: boolean;
  doneAt: number | null;
  createdAt: number;
  /** Posição dentro da lista (menor = mais prioritário) */
  order: number;
};

export type TaskDraft = Pick<Task, "title"> &
  Partial<Pick<Task, "contextId" | "due" | "requester" | "notes" | "checklist" | "tagIds">>;

type State = { version: 1; contexts: Context[]; tasks: Task[]; tags: Tag[] };

const STORAGE_KEY = "pauta:v1";

export const CONTEXT_COLORS = [
  "#4f46e5", // índigo
  "#0ea5e9", // azul céu
  "#12a150", // verde
  "#f97316", // laranja
  "#e5484d", // vermelho
  "#d946ef", // magenta
  "#d97706", // âmbar
  "#64748b", // grafite
];

/** Cores de tag: tons que funcionam como texto sobre fundo claro. */
export const TAG_COLORS = [
  "#4f46e5",
  "#0284c7",
  "#0f8a44",
  "#c2410c",
  "#be123c",
  "#a21caf",
  "#b45309",
  "#475569",
];

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function seed(): State {
  return {
    version: 1,
    contexts: [
      { id: uid(), name: "Trabalho", color: CONTEXT_COLORS[0], order: 0 },
      { id: uid(), name: "Retake", color: CONTEXT_COLORS[3], order: 1 },
      { id: uid(), name: "Pessoal", color: CONTEXT_COLORS[2], order: 2 },
    ],
    tasks: [],
    tags: [],
  };
}

/** Completa campos que versões antigas não tinham. */
function normalize(raw: Partial<State> & { contexts: Context[]; tasks: Partial<Task>[] }): State {
  return {
    version: 1,
    contexts: raw.contexts,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    tasks: raw.tasks.map(
      (t): Task => ({
        id: t.id ?? uid(),
        title: t.title ?? "",
        contextId: t.contextId ?? null,
        due: t.due ?? null,
        requester: t.requester ?? "",
        notes: t.notes ?? "",
        checklist: Array.isArray(t.checklist) ? t.checklist : [],
        tagIds: Array.isArray(t.tagIds) ? t.tagIds : [],
        done: t.done ?? false,
        doneAt: t.doneAt ?? null,
        createdAt: t.createdAt ?? Date.now(),
        order: t.order ?? 0,
      }),
    ),
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw);
    return isState(parsed) ? normalize(parsed) : seed();
  } catch {
    return seed();
  }
}

function isState(value: unknown): value is Parameters<typeof normalize>[0] {
  const v = value as State;
  return !!v && Array.isArray(v.contexts) && Array.isArray(v.tasks);
}

/* ---------- Sincronização com o servidor do PC (mesma lista no PC e no celular) ---------- */

const SYNC_KEY = "pauta:sync";
const API = `${import.meta.env.BASE_URL}api/state`;
const POLL_MS = 5000;

/** Última versão confirmada pelo servidor (rev null = este aparelho nunca sincronizou). */
type SyncMeta = { rev: number | null; base: State | null };
type Remote = { rev: number; state: unknown };

function loadSync(): SyncMeta {
  try {
    const parsed = JSON.parse(localStorage.getItem(SYNC_KEY) ?? "null");
    if (parsed && (parsed.rev === null || typeof parsed.rev === "number")) {
      return { rev: parsed.rev, base: isState(parsed.base) ? normalize(parsed.base) : null };
    }
  } catch {
    /* ignora */
  }
  return { rev: null, base: null };
}

function saveSync(meta: SyncMeta) {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(meta));
  } catch {
    /* ignora */
  }
}

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Mescla item a item: o que este aparelho mudou desde a base vence; o resto vem do servidor. */
function mergeById<T extends { id: string }>(base: T[], local: T[], remote: T[]): T[] {
  const b = new Map(base.map((x) => [x.id, x]));
  const l = new Map(local.map((x) => [x.id, x]));
  const r = new Map(remote.map((x) => [x.id, x]));
  const out: T[] = [];
  for (const id of new Set([...r.keys(), ...l.keys()])) {
    const pick = same(b.get(id), l.get(id)) ? r.get(id) : l.get(id);
    if (pick) out.push(pick);
  }
  return out;
}

function merge(base: State | null, local: State, remote: State): State {
  const b = base ?? { version: 1 as const, contexts: [], tasks: [], tags: [] };
  return {
    version: 1,
    contexts: mergeById(b.contexts, local.contexts, remote.contexts),
    tasks: mergeById(b.tasks, local.tasks, remote.tasks),
    tags: mergeById(b.tags, local.tags, remote.tags),
  };
}

function useServerSync(state: State, setState: (s: State) => void) {
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const [initialMeta] = useState<SyncMeta>(() => {
    const m = loadSync();
    // Se o que está salvo localmente é igual à base, usa o mesmo objeto (= nada pendente).
    return m.base && same(m.base, state) ? { ...m, base: state } : m;
  });
  const meta = useRef<SyncMeta | null>(initialMeta);
  const busy = useRef(false);
  const disabled = useRef(false);

  const setMeta = useCallback((rev: number, base: State) => {
    meta.current = { rev, base };
    saveSync(meta.current);
  }, []);

  /** Envia até o servidor ter a versão atual (mesclando se outro aparelho gravou antes). */
  const push = useCallback(async (): Promise<void> => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const m = meta.current!;
      const snapshot = stateRef.current;
      if (snapshot === m.base) return;
      const res = await fetch(API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseRev: m.rev ?? 0, state: snapshot }),
      });
      if (res.ok) {
        const { rev } = (await res.json()) as { rev: number };
        setMeta(rev, snapshot);
      } else if (res.status === 409) {
        const remote = (await res.json()) as Remote;
        if (!isState(remote.state)) return;
        const server = normalize(remote.state);
        const merged = merge(m.base, stateRef.current, server);
        setMeta(remote.rev, server);
        stateRef.current = merged;
        setState(merged);
      } else return;
    }
  }, [setMeta, setState]);

  const sync = useCallback(async () => {
    if (busy.current || disabled.current) return;
    busy.current = true;
    try {
      const res = await fetch(API, { cache: "no-store" });
      if (res.status === 404) {
        disabled.current = true; // sem servidor (ex.: GitHub Pages): fica só local
        return;
      }
      if (!res.ok) return;
      const remote = (await res.json()) as Remote;
      const m = meta.current!;
      const local = stateRef.current;
      const pending = local !== m.base;

      if (!isState(remote.state)) {
        // Servidor vazio: este aparelho envia o que tem.
        meta.current = { rev: remote.rev, base: null };
        await push();
        return;
      }
      const server = normalize(remote.state);

      if (m.rev === null && server.tasks.length === 0 && local.tasks.length > 0) {
        // Primeira conexão de um aparelho que já tinha tarefas: elas vão para o servidor.
        meta.current = { rev: remote.rev, base: server };
        await push();
      } else if (m.rev === null) {
        setMeta(remote.rev, server);
        setState(server);
      } else if (pending) {
        const merged = remote.rev === m.rev ? local : merge(m.base, local, server);
        meta.current = { rev: remote.rev, base: server };
        stateRef.current = merged;
        setState(merged);
        await push();
      } else if (remote.rev !== m.rev) {
        setMeta(remote.rev, server);
        setState(server);
      }
    } catch {
      /* offline: tenta de novo depois */
    } finally {
      busy.current = false;
    }
  }, [push, setMeta, setState]);

  // Mudança local: envia logo (com um pequeno atraso para juntar digitação).
  useEffect(() => {
    if (state === meta.current?.base) return;
    const t = window.setTimeout(sync, 400);
    return () => window.clearTimeout(t);
  }, [state, sync]);

  // Busca novidades ao abrir, ao voltar para o app e periodicamente enquanto visível.
  useEffect(() => {
    sync();
    const onWake = () => document.visibilityState === "visible" && sync();
    const timer = window.setInterval(onWake, POLL_MS);
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [sync]);
}

export function useStore() {
  const [state, setState] = useState<State>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* armazenamento cheio ou indisponível */
    }
  }, [state]);

  useServerSync(state, setState);

  // Mantém abas diferentes do navegador em sincronia.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const next = JSON.parse(event.newValue);
          if (isState(next)) setState(normalize(next));
        } catch {
          /* ignora */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addTask = useCallback((draft: TaskDraft) => {
    const task: Task = {
      id: uid(),
      title: draft.title.trim(),
      contextId: draft.contextId ?? null,
      due: draft.due ?? null,
      requester: draft.requester?.trim() ?? "",
      notes: draft.notes?.trim() ?? "",
      checklist: draft.checklist ?? [],
      tagIds: draft.tagIds ?? [],
      done: false,
      doneAt: null,
      createdAt: Date.now(),
      order: 0,
    };
    setState((s) => {
      const siblings = s.tasks.filter((t) => t.contextId === task.contextId && !t.done);
      task.order = siblings.reduce((max, t) => Math.max(max, t.order), -1) + 1;
      return { ...s, tasks: [...s.tasks, task] };
    });
    return task;
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setState((s) => {
      const current = s.tasks.find((t) => t.id === id);
      if (!current) return s;
      const next = { ...current, ...patch };
      // Mudou de lista: entra no fim da fila da nova lista.
      if (patch.contextId !== undefined && patch.contextId !== current.contextId) {
        const siblings = s.tasks.filter((t) => t.contextId === patch.contextId && !t.done);
        next.order = siblings.reduce((max, t) => Math.max(max, t.order), -1) + 1;
      }
      return { ...s, tasks: s.tasks.map((t) => (t.id === id ? next : t)) };
    });
  }, []);

  const setDone = useCallback((id: string, done: boolean) => {
    setState((s) => {
      const current = s.tasks.find((t) => t.id === id);
      if (!current) return s;
      let order = current.order;
      if (!done) {
        // Reaberta: volta para o fim da fila.
        const siblings = s.tasks.filter((t) => t.contextId === current.contextId && !t.done);
        order = siblings.reduce((max, t) => Math.max(max, t.order), -1) + 1;
      }
      return {
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === id ? { ...t, done, doneAt: done ? Date.now() : null, order } : t,
        ),
      };
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  }, []);

  const restoreTask = useCallback((task: Task) => {
    setState((s) =>
      s.tasks.some((t) => t.id === task.id) ? s : { ...s, tasks: [...s.tasks, task] },
    );
  }, []);

  const clearDone = useCallback((contextId: string | null) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.filter((t) => !(t.done && t.contextId === contextId)),
    }));
  }, []);

  /** Recebe os ids de uma lista na nova ordem de prioridade. */
  const reorderTasks = useCallback((ids: string[]) => {
    const position = new Map(ids.map((id, index) => [id, index]));
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (position.has(t.id) ? { ...t, order: position.get(t.id)! } : t)),
    }));
  }, []);

  const addContext = useCallback((name: string, color?: string) => {
    const context: Context = { id: uid(), name: name.trim(), color: color ?? CONTEXT_COLORS[0], order: 0 };
    setState((s) => {
      context.order = s.contexts.reduce((max, c) => Math.max(max, c.order), -1) + 1;
      if (!color) context.color = CONTEXT_COLORS[s.contexts.length % CONTEXT_COLORS.length];
      return { ...s, contexts: [...s.contexts, context] };
    });
    return context;
  }, []);

  const updateContext = useCallback((id: string, patch: Partial<Context>) => {
    setState((s) => ({
      ...s,
      contexts: s.contexts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, []);

  /** Remove a lista; as tarefas dela voltam para a Entrada. */
  const deleteContext = useCallback((id: string) => {
    setState((s) => {
      const inboxMax = s.tasks
        .filter((t) => t.contextId === null && !t.done)
        .reduce((max, t) => Math.max(max, t.order), -1);
      let offset = 0;
      return {
        ...s,
        contexts: s.contexts.filter((c) => c.id !== id),
        tasks: s.tasks
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((t) => (t.contextId === id ? { ...t, contextId: null, order: inboxMax + ++offset } : t)),
      };
    });
  }, []);

  const reorderContexts = useCallback((ids: string[]) => {
    const position = new Map(ids.map((id, index) => [id, index]));
    setState((s) => ({
      ...s,
      contexts: s.contexts.map((c) => (position.has(c.id) ? { ...c, order: position.get(c.id)! } : c)),
    }));
  }, []);

  const exportData = useCallback(() => JSON.stringify(state, null, 2), [state]);

  const importData = useCallback((json: string) => {
    const parsed = JSON.parse(json);
    if (!isState(parsed)) throw new Error("Arquivo inválido");
    setState(normalize(parsed));
  }, []);

  const addTag = useCallback((name: string, color?: string) => {
    const tag: Tag = { id: uid(), name: name.trim(), color: color ?? TAG_COLORS[0] };
    setState((s) => {
      // Quem chama deve checar nomes repetidos antes; aqui só evita duplicar.
      if (s.tags.some((t) => t.name.toLowerCase() === tag.name.toLowerCase())) return s;
      if (!color) tag.color = TAG_COLORS[s.tags.length % TAG_COLORS.length];
      return { ...s, tags: [...s.tags, tag] };
    });
    return tag;
  }, []);

  const updateTag = useCallback((id: string, patch: Partial<Tag>) => {
    setState((s) => ({ ...s, tags: s.tags.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }, []);

  /** Remove a tag de todas as tarefas. */
  const deleteTag = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      tags: s.tags.filter((t) => t.id !== id),
      tasks: s.tasks.map((t) => (t.tagIds.includes(id) ? { ...t, tagIds: t.tagIds.filter((x) => x !== id) } : t)),
    }));
  }, []);

  const contexts = [...state.contexts].sort((a, b) => a.order - b.order);

  return {
    contexts,
    tasks: state.tasks,
    tags: [...state.tags].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    addTag,
    updateTag,
    deleteTag,
    addTask,
    updateTask,
    setDone,
    deleteTask,
    restoreTask,
    clearDone,
    reorderTasks,
    addContext,
    updateContext,
    deleteContext,
    reorderContexts,
    exportData,
    importData,
  };
}

export type Store = ReturnType<typeof useStore>;
