import { CalendarPlus, Check, Inbox, Plus, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { Checkbox } from "@/components/motion/checkbox";
import { Input } from "@/components/motion/input";
import { Chip } from "@/components/Chip";
import { formatShort, fromISODate, quickDates } from "@/lib/dates";
import { type ChecklistItem, type Context, type Tag, type Task, type TaskDraft, uid } from "@/lib/store";
import { cn } from "@/lib/utils";

export type SheetState =
  | { mode: "closed" }
  | { mode: "create"; title: string; contextId: string | null; tagIds?: string[] }
  | { mode: "edit"; task: Task };

type Props = {
  state: SheetState;
  contexts: Context[];
  tags: Tag[];
  onClose: () => void;
  onCreate: (draft: TaskDraft) => void;
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onDelete: (task: Task) => void;
  onAddContext: (name: string) => Context;
  onAddTag: (name: string) => Tag;
};

const FIELD = { field: "h-12 rounded-2xl", input: "text-base" };

export function TaskSheet({ state, contexts, tags, onClose, onCreate, onUpdate, onDelete, onAddContext, onAddTag }: Props) {
  const open = state.mode !== "closed";
  const editing = state.mode === "edit" ? state.task : null;

  const [title, setTitle] = useState("");
  const [contextId, setContextId] = useState<string | null>(null);
  const [due, setDue] = useState<string | null>(null);
  const [requester, setRequester] = useState("");
  const [notes, setNotes] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [error, setError] = useState<string | false>(false);
  const [newContext, setNewContext] = useState<string | null>(null);
  const [newTag, setNewTag] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");
  const dateInput = useRef<HTMLInputElement>(null);
  const newItemInput = useRef<HTMLInputElement>(null);

  // Preenche o formulário toda vez que o painel abre.
  useEffect(() => {
    if (state.mode === "create") {
      setTitle(state.title);
      setContextId(state.contextId);
      setDue(null);
      setRequester("");
      setNotes("");
      setChecklist([]);
      setTagIds(state.tagIds ?? []);
    } else if (state.mode === "edit") {
      setTitle(state.task.title);
      setContextId(state.task.contextId);
      setDue(state.task.due);
      setRequester(state.task.requester);
      setNotes(state.task.notes);
      setChecklist(state.task.checklist);
      setTagIds(state.task.tagIds);
    }
    setError(false);
    setNewContext(null);
    setNewTag(null);
    setNewItem("");
  }, [state]);

  /** Junta o item que ficou digitado e não foi confirmado. */
  const finalChecklist = () => {
    const pending = newItem.trim();
    const items = checklist
      .map((i) => ({ ...i, text: i.text.trim() }))
      .filter((i) => i.text);
    return pending ? [...items, { id: uid(), text: pending, done: false }] : items;
  };

  const collect = () => ({
    title: title.trim(),
    contextId,
    due,
    requester: requester.trim(),
    notes: notes.trim(),
    checklist: finalChecklist(),
    tagIds: tagIds.filter((id) => tags.some((t) => t.id === id)),
  });

  const submit = () => {
    if (!title.trim()) {
      setError("Dê um título para a tarefa");
      return;
    }
    if (editing) onUpdate(editing.id, collect());
    else onCreate(collect());
    onClose();
  };

  /** Fechar arrastando ou tocando fora: na edição, salva o que mudou. */
  const dismiss = () => {
    if (editing) {
      const data = collect();
      onUpdate(editing.id, data.title ? data : { ...data, title: editing.title });
    }
    onClose();
  };

  const confirmNewContext = () => {
    const name = newContext?.trim();
    if (name) setContextId(onAddContext(name).id);
    setNewContext(null);
  };

  const confirmNewTag = () => {
    const name = newTag?.trim().replace(/^#/, "");
    if (name) {
      const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
      const id = existing ? existing.id : onAddTag(name).id;
      setTagIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    }
    setNewTag(null);
  };

  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    setChecklist((items) => [...items, { id: uid(), text, done: false }]);
    setNewItem("");
    newItemInput.current?.focus();
  };

  const toggleTag = (id: string) =>
    setTagIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const quick = quickDates().filter((d, i, all) => all.findIndex((x) => x.value === d.value) === i);
  const customDue = due && !quick.some((q) => q.value === due) ? due : null;
  const doneCount = checklist.filter((i) => i.done).length;

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !next && dismiss()}
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

        {/* Checklist */}
        <section className="flex flex-col gap-2" aria-labelledby="checklist-title">
          <div className="flex items-baseline justify-between px-1">
            <h3 id="checklist-title" className="text-sm font-medium">
              Checklist
            </h3>
            {checklist.length ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {doneCount} de {checklist.length}
              </span>
            ) : null}
          </div>
          {checklist.length ? (
            <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-success transition-[width] duration-300"
                style={{ width: `${(doneCount / checklist.length) * 100}%` }}
              />
            </div>
          ) : null}
          <ul className="flex flex-col">
            {checklist.map((item) => (
              <li key={item.id} className="group flex items-center">
                <Checkbox
                  checked={item.done}
                  onCheckedChange={(done) =>
                    setChecklist((items) => items.map((i) => (i.id === item.id ? { ...i, done } : i)))
                  }
                  aria-label={item.done ? `Desmarcar "${item.text}"` : `Marcar "${item.text}"`}
                  className="size-10 shrink-0 justify-center"
                />
                <input
                  value={item.text}
                  onChange={(e) =>
                    setChecklist((items) =>
                      items.map((i) => (i.id === item.id ? { ...i, text: e.target.value } : i)),
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      newItemInput.current?.focus();
                    }
                  }}
                  aria-label="Item do checklist"
                  className={cn(
                    "h-10 min-w-0 flex-1 rounded-lg bg-transparent px-2 outline-none focus:bg-muted",
                    item.done && "text-muted-foreground line-through",
                  )}
                />
                <button
                  type="button"
                  aria-label={`Remover "${item.text}"`}
                  onClick={() => setChecklist((items) => items.filter((i) => i.id !== item.id))}
                  className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                >
                  <X size={16} />
                </button>
              </li>
            ))}
            <li className="flex items-center">
              <span className="grid size-10 shrink-0 place-items-center text-muted-foreground">
                <Plus size={16} />
              </span>
              <input
                ref={newItemInput}
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem();
                  }
                }}
                placeholder="Adicionar item"
                aria-label="Novo item do checklist"
                enterKeyHint="enter"
                className="h-10 min-w-0 flex-1 rounded-lg bg-transparent px-2 outline-none placeholder:text-muted-foreground/70 focus:bg-muted"
              />
            </li>
          </ul>
        </section>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 px-1 text-sm font-medium">Lista</legend>
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
            <InlineCreate
              value={newContext}
              onChange={setNewContext}
              onConfirm={confirmNewContext}
              onCancel={() => setNewContext(null)}
              placeholder="Nome da lista"
            />
          ) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 px-1 text-sm font-medium">Tags</legend>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const selected = tagIds.includes(tag.id);
              return (
                <Chip
                  key={tag.id}
                  selected={selected}
                  icon={selected ? <Check size={14} strokeWidth={3} /> : undefined}
                  onClick={() => toggleTag(tag.id)}
                  className={cn(selected && "border-current bg-transparent")}
                  style={selected ? { color: tag.color, background: `${tag.color}14` } : undefined}
                >
                  #{tag.name}
                </Chip>
              );
            })}
            {newTag === null ? (
              <Chip icon={<Plus size={16} />} onClick={() => setNewTag("")} className="border-dashed">
                {tags.length ? "Nova tag" : "Criar tag"}
              </Chip>
            ) : null}
          </div>
          {newTag !== null ? (
            <InlineCreate
              value={newTag}
              onChange={setNewTag}
              onConfirm={confirmNewTag}
              onCancel={() => setNewTag(null)}
              placeholder="Ex.: urgente, reunião, financeiro"
            />
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

function InlineCreate({
  value,
  onChange,
  onConfirm,
  onCancel,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onConfirm();
          }
          if (e.key === "Escape") {
            e.stopPropagation();
            onCancel();
          }
        }}
        placeholder={placeholder}
        className="h-10 min-w-0 flex-1 rounded-full border border-border px-4 outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring/40"
      />
      <button
        type="button"
        onClick={onConfirm}
        className="h-10 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Criar
      </button>
      <button
        type="button"
        aria-label="Cancelar"
        onClick={onCancel}
        className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <X size={16} />
      </button>
    </div>
  );
}
