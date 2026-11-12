import { useCallback, useEffect, useState } from "react";

/** Uma "empresa" (ou contexto): Trabalho, Retake, Pessoal... */
export type Context = {
  id: string;
  name: string;
  color: string;
  order: number;
};

export type Task = {
  id: string;
  title: string;
  /** null = ainda na Entrada (sem empresa) */
  contextId: string | null;
  /** Data no formato YYYY-MM-DD */
  due: string | null;
  requester: string;
  notes: string;
  done: boolean;
  doneAt: number | null;
  createdAt: number;
  /** Posição dentro da lista da empresa (menor = mais prioritário) */
  order: number;
};

export type TaskDraft = Pick<Task, "title"> &
  Partial<Pick<Task, "contextId" | "due" | "requester" | "notes">>;

type State = { version: 1; contexts: Context[]; tasks: Task[] };

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
    ],
    tasks: [],
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as State;
    if (!Array.isArray(parsed.contexts) || !Array.isArray(parsed.tasks)) return seed();
    return parsed;
  } catch {
    return seed();
  }
}

function isState(value: unknown): value is State {
  const v = value as State;
  return !!v && Array.isArray(v.contexts) && Array.isArray(v.tasks);
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

  // Mantém abas diferentes do navegador em sincronia.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const next = JSON.parse(event.newValue);
          if (isState(next)) setState(next);
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
      // Mudou de empresa: entra no fim da fila da nova empresa.
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

  /** Remove a empresa; as tarefas dela voltam para a Entrada. */
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
    setState({ version: 1, contexts: parsed.contexts, tasks: parsed.tasks });
  }, []);

  const contexts = [...state.contexts].sort((a, b) => a.order - b.order);

  return {
    contexts,
    tasks: state.tasks,
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
