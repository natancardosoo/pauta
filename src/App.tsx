import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, ChevronDown, Inbox, Settings2, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatedToastStack, useAnimatedToastStack } from "@/components/motion/animated-toast-stack";
import { SortableList, SortableListGroup } from "@/components/motion/sortable-list";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { ContextsSheet } from "@/components/ContextsSheet";
import { DoneTaskRow, SortableTaskRow } from "@/components/TaskRow";
import { type SheetState, TaskSheet } from "@/components/TaskSheet";
import { daysFromToday, formatLong } from "@/lib/dates";
import { LocaleProvider } from "@/lib/i18n";
import { type Task, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const INBOX = "inbox";
const ACTIVE_TAB_KEY = "pauta:tab";
const COMPLETE_DELAY = 450;

const MESSAGES = {
  sortableList: {
    label: "Tarefas por prioridade",
    instructions:
      "Arraste pela alça para mudar a prioridade. Com a alça focada, use as setas para cima e para baixo.",
    moved: "{item} agora é a prioridade {position} de {total}.",
    restored: "Ordem anterior restaurada.",
    reorder: "Mover {item}",
    undo: "Desfazer",
  },
  tabs: { scrollLeft: "Rolar abas para a esquerda", scrollRight: "Rolar abas para a direita" },
  checkbox: { checked: "Concluída", indeterminate: "Parcial" },
  animatedToastStack: { dismiss: "Fechar aviso" },
  bottomSheet: { label: "Painel", close: "Fechar" },
};

export default function App() {
  const store = useStore();
  const { contexts, tasks, tags } = store;
  const reduce = useReducedMotion();
  const toast = useAnimatedToastStack({ defaultDuration: 4000, limit: 3 });

  const [tab, setTab] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_TAB_KEY) ?? INBOX;
    } catch {
      return INBOX;
    }
  });
  const [sheet, setSheet] = useState<SheetState>({ mode: "closed" });
  const [contextsOpen, setContextsOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const quickInput = useRef<HTMLInputElement>(null);

  // Se a lista da aba atual for removida, volta para a Entrada.
  const activeTab = tab === INBOX || contexts.some((c) => c.id === tab) ? tab : INBOX;
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    } catch {
      /* armazenamento indisponível */
    }
  }, [activeTab]);

  // No PC: "/" ou "n" foca o campo de anotação.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [role=dialog]") || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "/" || event.key === "n") {
        event.preventDefault();
        quickInput.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeContextId = activeTab === INBOX ? null : activeTab;
  const activeContext = contexts.find((c) => c.id === activeContextId);
  const contextById = useMemo(() => new Map(contexts.map((c) => [c.id, c])), [contexts]);
  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const tagsOf = (task: Task) => task.tagIds.flatMap((id) => tagById.get(id) ?? []);

  const pendingFor = useCallback(
    (contextId: string | null) =>
      tasks.filter((t) => t.contextId === contextId && !t.done).sort((a, b) => a.order - b.order),
    [tasks],
  );
  const listPending = pendingFor(activeContextId);
  const listDone = tasks
    .filter((t) => t.contextId === activeContextId && t.done)
    .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));

  // Tags usadas nesta lista viram filtros.
  const listTags = tags.filter((tag) => [...listPending, ...listDone].some((t) => t.tagIds.includes(tag.id)));
  const activeFilter = tagFilter && listTags.some((t) => t.id === tagFilter) ? tagFilter : null;
  const byFilter = (t: Task) => !activeFilter || t.tagIds.includes(activeFilter);
  const pending = listPending.filter(byFilter);
  const done = listDone.filter(byFilter);

  const allPending = tasks.filter((t) => !t.done);
  const dueToday = allPending.filter((t) => t.due && daysFromToday(t.due) === 0).length;
  const overdue = allPending.filter((t) => t.due && daysFromToday(t.due) < 0).length;

  const notify = (title: string, status: "success" | "error" | "neutral" = "neutral") =>
    toast.showToast({ title, status });

  const addQuick = () => {
    const title = draft.trim();
    if (!title) {
      quickInput.current?.focus();
      return;
    }
    store.addTask({ title, contextId: activeContextId, tagIds: activeFilter ? [activeFilter] : [] });
    setDraft("");
    quickInput.current?.focus();
  };

  const toggle = (task: Task) => {
    if (task.done) {
      store.setDone(task.id, false);
      return;
    }
    if (completing.has(task.id)) return;
    setCompleting((s) => new Set(s).add(task.id));
    window.setTimeout(() => {
      store.setDone(task.id, true);
      setCompleting((s) => {
        const next = new Set(s);
        next.delete(task.id);
        return next;
      });
      toast.showToast({
        title: "Concluída",
        description: task.title,
        status: "success",
        action: {
          label: "Desfazer",
          onClick: (t) => {
            store.updateTask(task.id, { done: false, doneAt: null, order: task.order });
            toast.dismissToast(t.id);
          },
        },
      });
    }, reduce ? 0 : COMPLETE_DELAY);
  };

  const remove = (task: Task) => {
    store.deleteTask(task.id);
    toast.showToast({
      title: "Tarefa excluída",
      description: task.title,
      status: "neutral",
      action: {
        label: "Desfazer",
        onClick: (t) => {
          store.restoreTask(task);
          toast.dismissToast(t.id);
        },
      },
    });
  };

  return (
    <LocaleProvider locale="pt-BR" messages={MESSAGES}>
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
        {/* Cabeçalho */}
        <header className="sticky top-0 z-30 bg-background pt-[env(safe-area-inset-top)]">
          <div className="flex items-start justify-between gap-4 px-4 pb-4 pt-6">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {formatLong(new Date())}
              </p>
              <h1 className="mt-1 text-[28px] font-bold leading-8 tracking-tight">Pauta</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {allPending.length === 0 ? (
                  "Nada pendente. Aproveita!"
                ) : (
                  <>
                    {allPending.length} pendente{allPending.length > 1 ? "s" : ""}
                    {dueToday > 0 ? <> · <span className="font-medium text-primary">{dueToday} pra hoje</span></> : null}
                    {overdue > 0 ? <> · <span className="font-medium text-destructive">{overdue} atrasada{overdue > 1 ? "s" : ""}</span></> : null}
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setContextsOpen(true)}
              aria-label="Gerenciar listas e tags"
              className="grid size-12 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Settings2 size={20} />
            </button>
          </div>

          <div className="border-b border-border px-4 pb-2">
            <Tabs value={activeTab} onValueChange={setTab} variant="pill">
              <TabsList className="gap-1">
                <TabsTrigger value={INBOX} icon={<Inbox size={16} />} className="h-10">
                  Entrada
                  <Count value={pendingFor(null).length} active={activeTab === INBOX} />
                </TabsTrigger>
                {contexts.map((c) => (
                  <TabsTrigger
                    key={c.id}
                    value={c.id}
                    icon={<span className="size-2 rounded-full" style={{ background: c.color }} />}
                    className="h-10"
                  >
                    {c.name}
                    <Count value={pendingFor(c.id).length} active={activeTab === c.id} />
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </header>

        {/* Lista */}
        <main className="flex-1 px-4 pb-40 pt-4">
          {listTags.length ? (
            <div
              className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]"
              role="group"
              aria-label="Filtrar por tag"
            >
              {listTags.map((tag) => {
                const on = activeFilter === tag.id;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setTagFilter(on ? null : tag.id)}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors",
                      on ? "border-current" : "border-border hover:bg-muted",
                    )}
                    style={{ color: tag.color, background: on ? `${tag.color}14` : undefined }}
                  >
                    #{tag.name}
                    {on ? <X size={12} aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {activeFilter && pending.length > 1 ? (
            <p className="mb-2 px-2 text-xs leading-4 text-muted-foreground">
              Para mudar a prioridade, tire o filtro.
            </p>
          ) : null}

          {pending.length === 0 ? (
            activeFilter ? (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                Nenhuma tarefa pendente com essa tag aqui.
              </p>
            ) : (
            <EmptyState inbox={activeTab === INBOX} name={activeContext?.name} hasDone={done.length > 0} />
            )
          ) : (
            <SortableList<Task>
              items={pending}
              onItemsChange={(items) => store.reorderTasks(items.map((t) => t.id))}
              getItemLabel={(t) => t.title}
              disabled={!!activeFilter}
              className="max-w-none"
            >
              {(items) => (
                <SortableListGroup className="space-y-2">
                  {items.map((task) => (
                    <SortableTaskRow
                      key={task.id}
                      task={task}
                      context={task.contextId ? contextById.get(task.contextId) : undefined}
                      tags={tagsOf(task)}
                      disabled={!!activeFilter}
                      completing={completing.has(task.id)}
                      onToggle={toggle}
                      onOpen={(t) => setSheet({ mode: "edit", task: t })}
                    />
                  ))}
                </SortableListGroup>
              )}
            </SortableList>
          )}

          {activeTab === INBOX && pending.length > 0 && contexts.length > 0 ? (
            <p className="mt-4 px-2 text-xs leading-4 text-muted-foreground">
              Toque numa tarefa para mandar para uma lista.
            </p>
          ) : null}

          {done.length > 0 ? (
            <section className="mt-8">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowDone((v) => !v)}
                  aria-expanded={showDone}
                  className="inline-flex h-10 items-center gap-2 rounded-full px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <motion.span animate={{ rotate: showDone ? 0 : -90 }} className="inline-flex">
                    <ChevronDown size={16} />
                  </motion.span>
                  Concluídas ({done.length})
                </button>
                {showDone ? (
                  <button
                    type="button"
                    onClick={() => {
                      store.clearDone(activeContextId);
                      notify("Concluídas apagadas");
                    }}
                    className="h-10 rounded-full px-4 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    Limpar
                  </button>
                ) : null}
              </div>
              <AnimatePresence initial={false}>
                {showDone ? (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: reduce ? 0 : 0.25 }}
                    className="overflow-hidden"
                  >
                    {done.map((task) => (
                      <DoneTaskRow
                        key={task.id}
                        task={task}
                        onToggle={toggle}
                        onOpen={(t) => setSheet({ mode: "edit", task: t })}
                      />
                    ))}
                  </motion.ul>
                ) : null}
              </AnimatePresence>
            </section>
          ) : null}
        </main>

        {/* Captura rápida — sempre ao alcance do polegar */}
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto max-w-2xl bg-gradient-to-t from-background via-background to-transparent px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-8">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addQuick();
              }}
              className="pointer-events-auto flex h-14 items-center gap-1 rounded-full border border-border bg-background pl-2 pr-1 shadow-[0_8px_24px_-8px_rgba(20,22,31,0.18)] focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10"
            >
              <button
                type="button"
                onClick={() => {
                  setSheet({
                    mode: "create",
                    title: draft.trim(),
                    contextId: activeContextId,
                    tagIds: activeFilter ? [activeFilter] : [],
                  });
                  setDraft("");
                }}
                aria-label="Adicionar com detalhes"
                className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <SlidersHorizontal size={18} />
              </button>
              <input
                ref={quickInput}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={activeContext ? `Anotar em ${activeContext.name}…` : "Anotar tarefa…"}
                aria-label="Nova tarefa"
                enterKeyHint="send"
                className="h-full min-w-0 flex-1 bg-transparent px-2 outline-none placeholder:text-muted-foreground/70"
              />
              <motion.button
                type="submit"
                aria-label="Adicionar tarefa"
                whileTap={reduce ? undefined : { scale: 0.92 }}
                className={cn(
                  "grid size-12 shrink-0 place-items-center rounded-full transition-colors",
                  draft.trim() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                <ArrowUp size={20} strokeWidth={2.5} />
              </motion.button>
            </form>
          </div>
        </div>

        <AnimatedToastStack
          toasts={toast.toasts}
          onDismiss={toast.dismissToast}
          position="bottom-center"
          placement="fixed"
          className="bottom-[calc(96px+env(safe-area-inset-bottom))]"
        />

        <TaskSheet
          state={sheet}
          contexts={contexts}
          tags={tags}
          onAddTag={(name) => store.addTag(name)}
          onClose={() => setSheet({ mode: "closed" })}
          onCreate={(d) => {
            const created = store.addTask(d);
            if (created.contextId !== activeContextId) {
              const where = created.contextId ? contextById.get(created.contextId)?.name : "Entrada";
              notify(`Adicionada em ${where ?? "outra lista"}`, "success");
            }
          }}
          onUpdate={store.updateTask}
          onDelete={remove}
          onAddContext={(name) => store.addContext(name)}
        />

        <ContextsSheet
          open={contextsOpen}
          onClose={() => setContextsOpen(false)}
          store={store}
          tasks={tasks}
          onMessage={notify}
        />
      </div>
    </LocaleProvider>
  );
}

function Count({ value, active }: { value: number; active: boolean }) {
  if (value === 0) return null;
  return (
    <span
      className={cn(
        "ml-1 rounded-full px-1.5 text-xs tabular-nums",
        active ? "bg-white/20 text-white" : "bg-foreground/5 text-muted-foreground",
      )}
    >
      {value}
    </span>
  );
}

function EmptyState({ inbox, name, hasDone }: { inbox: boolean; name?: string; hasDone: boolean }) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <div className="grid size-16 place-items-center rounded-2xl bg-primary-soft text-primary">
        {inbox ? <Inbox size={28} /> : <Sparkles size={28} />}
      </div>
      <h2 className="mt-6 text-lg font-semibold">
        {hasDone ? "Tudo feito por aqui" : inbox ? "Entrada vazia" : `Nada em ${name}`}
      </h2>
      <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
        {inbox
          ? "Anote qualquer coisa no campo abaixo. Depois você organiza por lista e prioridade."
          : "Escreva no campo abaixo para adicionar. Arraste pela alça para priorizar."}
      </p>
    </div>
  );
}
