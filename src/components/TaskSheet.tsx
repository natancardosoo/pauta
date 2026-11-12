import { CalendarPlus, Inbox, Plus, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { Input } from "@/components/motion/input";
import { Chip } from "@/components/Chip";
import { formatShort, fromISODate, quickDates } from "@/lib/dates";
import type { Context, Task, TaskDraft } from "@/lib/store";
import { cn } from "@/lib/utils";

export type SheetState =
  | { mode: "closed" }
  | { mode: "create"; title: string; contextId: string | null }
  | { mode: "edit"; task: Task };

type Props = {
  state: SheetState;
  contexts: Context[];
  onClose: () => void;
  onCreate: (draft: TaskDraft) => void;
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onDelete: (task: Task) => void;
  onAddContext: (name: string) => Context;
};

const FIELD = { field: "h-12 rounded-2xl", input: "text-base" };

export function TaskSheet({ state, contexts, onClose, onCreate, onUpdate, onDelete, onAddContext }: Props) {
  const open = state.mode !== "closed";
  const editing = state.mode === "edit" ? state.task : null;

  const [title, setTitle] = useState("");
  const [contextId, setContextId] = useState<string | null>(null);
  const [due, setDue] = useState<string | null>(null);
  const [requester, setRequester] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | false>(false);
  const [newContext, setNewContext] = useState<string | null>(null);
  const dateInput = useRef<HTMLInputElement>(null);

  // Preenche o formulário toda vez que o painel abre.
  useEffect(() => {
    if (state.mode === "create") {
      setTitle(state.title);
      setContextId(state.contextId);
      setDue(null);
      setRequester("");
      setNotes("");
    } else if (state.mode === "edit") {
      setTitle(state.task.title);
      setContextId(state.task.contextId);
      setDue(state.task.due);
      setRequester(state.task.requester);
      setNotes(state.task.notes);
    }
    setError(false);
    setNewContext(null);
  }, [state]);

  const submit = () => {
    if (!title.trim()) {
      setError("Dê um título para a tarefa");
      return;
    }
    const data = { title: title.trim(), contextId, due, requester: requester.trim(), notes: notes.trim() };
    if (editing) onUpdate(editing.id, data);
    else onCreate(data);
    onClose();
  };

  const confirmNewContext = () => {
    const name = newContext?.trim();
    if (name) setContextId(onAddContext(name).id);
    setNewContext(null);
  };

  const quick = quickDates().filter((d, i, all) => all.findIndex((x) => x.value === d.value) === i);
  const customDue = due && !quick.some((q) => q.value === due) ? due : null;

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      snapPoints={["auto"]}
      title={editing ? "Editar tarefa" : "Nova tarefa"}
      labels={{ label: "Tarefa", close: "Fechar" }}
    >
      <form
        className="flex flex-col gap-6 pt-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Input
          label="Título"
          placeholder="Ex.: Relatório de vendas pro chefe"
          value={title}
          onChange={(value) => {
            setTitle(value);
            if (error) setError(false);
          }}
          error={error}
          autoFocus={state.mode === "create" && !state.title}
          enterKeyHint="done"
          classNames={FIELD}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 px-1 text-sm font-medium">Empresa</legend>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            <Chip selected={contextId === null} icon={<Inbox size={16} />} onClick={() => setContextId(null)}>
              Entrada
            </Chip>
            {contexts.map((c) => (
              <Chip key={c.id} selected={contextId === c.id} color={c.color} onClick={() => setContextId(c.id)}>
                {c.name}
              </Chip>
            ))}
            {newContext === null ? (
              <Chip icon={<Plus size={16} />} onClick={() => setNewContext("")} className="border-dashed">
                Nova
              </Chip>
            ) : null}
          </div>
          {newContext !== null ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={newContext}
                onChange={(e) => setNewContext(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmNewContext();
                  }
                  if (e.key === "Escape") setNewContext(null);
                }}
                placeholder="Nome da empresa"
                className="h-10 min-w-0 flex-1 rounded-full border border-border px-4 outline-none focus:ring-2 focus:ring-ring/40"
              />
              <button
                type="button"
                onClick={confirmNewContext}
                className="h-10 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Criar
              </button>
              <button
                type="button"
                aria-label="Cancelar"
                onClick={() => setNewContext(null)}
                className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X size={16} />
              </button>
            </div>
          ) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 px-1 text-sm font-medium">Prazo</legend>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            <Chip selected={due === null} onClick={() => setDue(null)}>
              Sem prazo
            </Chip>
            {quick.map((q) => (
              <Chip key={q.label} selected={due === q.value} onClick={() => setDue(q.value)}>
                {q.label}
              </Chip>
            ))}
            <Chip
              selected={!!customDue}
              icon={<CalendarPlus size={16} />}
              onClick={() => {
                const el = dateInput.current;
                if (!el) return;
                if (typeof el.showPicker === "function") el.showPicker();
                else el.click();
              }}
            >
              {customDue ? formatShort(fromISODate(customDue)) : "Escolher"}
            </Chip>
            <input
              ref={dateInput}
              type="date"
              tabIndex={-1}
              aria-hidden
              value={due ?? ""}
              onChange={(e) => setDue(e.target.value || null)}
              className="pointer-events-none absolute size-0 opacity-0"
            />
          </div>
        </fieldset>

        <Input
          label="Quem pediu"
          placeholder="Opcional"
          value={requester}
          onChange={setRequester}
          leftIcon={<UserRound />}
          classNames={FIELD}
        />

        <div className="flex flex-col gap-2">
          <label htmlFor="task-notes" className="px-1 text-sm font-medium">
            Anotações
          </label>
          <textarea
            id="task-notes"
            rows={3}
            placeholder="Detalhes, links, o que precisa entregar…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-24 resize-none rounded-2xl border border-border px-4 py-3 leading-6 outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/40 focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <div className={cn("flex gap-2 pb-2", editing ? "justify-between" : "justify-end")}>
          {editing ? (
            <button
              type="button"
              onClick={() => {
                onDelete(editing);
                onClose();
              }}
              className="inline-flex h-12 items-center gap-2 rounded-full px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <Trash2 size={16} />
              Excluir
            </button>
          ) : null}
          <button
            type="submit"
            className="h-12 rounded-full bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-sm transition-transform active:scale-[0.98]"
          >
            {editing ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
