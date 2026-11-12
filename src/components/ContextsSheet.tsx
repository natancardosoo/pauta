import { Download, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import {
  SortableList,
  SortableListGroup,
  SortableListHandle,
  SortableListItem,
} from "@/components/motion/sortable-list";
import { CONTEXT_COLORS, type Context, type Store, TAG_COLORS, type Task } from "@/lib/store";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  store: Store;
  tasks: Task[];
  onMessage: (title: string, status?: "success" | "error") => void;
};

export function ContextsSheet({ open, onClose, store, tasks, onMessage }: Props) {
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [palette, setPalette] = useState<string | null>(null);
  const [tagName, setTagName] = useState("");
  const [tagPalette, setTagPalette] = useState<string | null>(null);
  const [confirmingTag, setConfirmingTag] = useState<string | null>(null);

  const tagCount = (id: string) => tasks.filter((t) => t.tagIds.includes(id)).length;

  const addTag = () => {
    const value = tagName.trim().replace(/^#/, "");
    if (!value) return;
    if (store.tags.some((t) => t.name.toLowerCase() === value.toLowerCase())) {
      onMessage(`A tag #${value} já existe`);
      return;
    }
    store.addTag(value);
    setTagName("");
  };
  const fileInput = useRef<HTMLInputElement>(null);

  const pendingCount = (id: string) => tasks.filter((t) => t.contextId === id && !t.done).length;

  const add = () => {
    if (!name.trim()) return;
    store.addContext(name);
    setName("");
  };

  const exportBackup = () => {
    const blob = new Blob([store.exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pauta-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File) => {
    try {
      store.importData(await file.text());
      onMessage("Backup restaurado", "success");
      onClose();
    } catch {
      onMessage("Não consegui ler esse arquivo", "error");
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      snapPoints={["auto"]}
      title="Listas e tags"
      labels={{ label: "Listas e tags", close: "Fechar" }}
    >
      <div className="flex flex-col gap-6 pt-2">
        <div>
          <h3 className="px-1 text-sm font-medium">Listas</h3>
          <p className="mt-1 px-1 text-xs leading-4 text-muted-foreground">
            Cada lista vira uma aba. Arraste para mudar a ordem.
          </p>
        </div>
        <SortableList<Context>
          items={store.contexts}
          onItemsChange={(items) => store.reorderContexts(items.map((c) => c.id))}
          getItemLabel={(c) => c.name}
          className="max-w-none"
          labels={{
            label: "Listas",
            instructions: "Arraste pela alça para reordenar. Com a alça focada, use as setas.",
            moved: "{item} agora está na posição {position} de {total}.",
            reorder: "Mover {item}",
          }}
        >
          {(items) => (
            <SortableListGroup className="space-y-2">
              {items.map((c) => (
                <SortableListItem key={c.id} id={c.id} className="flex-wrap gap-2 rounded-2xl p-2">
                  <SortableListHandle className="size-10" />
                  <button
                    type="button"
                    aria-label={`Cor de ${c.name}`}
                    onClick={() => setPalette(palette === c.id ? null : c.id)}
                    className="grid size-10 place-items-center rounded-full hover:bg-muted"
                  >
                    <span className="size-4 rounded-full ring-2 ring-white" style={{ background: c.color, boxShadow: `0 0 0 1px ${c.color}` }} />
                  </button>
                  <input
                    value={c.name}
                    onChange={(e) => store.updateContext(c.id, { name: e.target.value })}
                    onBlur={(e) => !e.target.value.trim() && store.updateContext(c.id, { name: "Sem nome" })}
                    aria-label="Nome da lista"
                    className="h-10 min-w-0 flex-1 rounded-lg bg-transparent px-2 font-medium outline-none focus:bg-muted"
                  />
                  <span className="text-xs tabular-nums text-muted-foreground">{pendingCount(c.id)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirming === c.id) {
                        store.deleteContext(c.id);
                        setConfirming(null);
                        onMessage(`Lista ${c.name} removida. As tarefas foram para a Entrada`);
                      } else setConfirming(c.id);
                    }}
                    onBlur={() => setConfirming(null)}
                    className={cn(
                      "inline-flex h-10 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors",
                      confirming === c.id
                        ? "bg-destructive px-4 text-destructive-foreground"
                        : "w-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                    )}
                    aria-label={confirming === c.id ? `Confirmar exclusão de ${c.name}` : `Excluir ${c.name}`}
                  >
                    {confirming === c.id ? "Excluir?" : <Trash2 size={16} />}
                  </button>
                  {palette === c.id ? (
                    <div className="flex w-full flex-wrap gap-2 pb-2 pl-12" role="radiogroup" aria-label="Cor">
                      {CONTEXT_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          role="radio"
                          aria-checked={c.color === color}
                          aria-label={color}
                          onClick={() => {
                            store.updateContext(c.id, { color });
                            setPalette(null);
                          }}
                          className={cn(
                            "size-8 rounded-full transition-transform hover:scale-110",
                            c.color === color && "ring-2 ring-foreground ring-offset-2",
                          )}
                          style={{ background: color }}
                        />
                      ))}
                    </div>
                  ) : null}
                </SortableListItem>
              ))}
            </SortableListGroup>
          )}
        </SortableList>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nova lista (ex.: Estudos)"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-border px-4 outline-none placeholder:text-muted-foreground/60 focus:border-foreground/40 focus:ring-2 focus:ring-ring/40"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            <Plus size={16} />
            Adicionar
          </button>
        </form>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <h3 className="px-1 text-sm font-medium">Tags</h3>
          <p className="px-1 text-xs leading-4 text-muted-foreground">
            Marque tarefas de qualquer lista e filtre por elas. Ao excluir uma tag, ela sai das tarefas.
          </p>
          {store.tags.length ? (
            <ul className="mt-2 flex flex-col gap-2">
              {store.tags.map((tag) => (
                <li key={tag.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border p-2">
                  <button
                    type="button"
                    aria-label={`Cor de #${tag.name}`}
                    onClick={() => setTagPalette(tagPalette === tag.id ? null : tag.id)}
                    className="grid size-10 place-items-center rounded-full font-semibold hover:bg-muted"
                    style={{ color: tag.color }}
                  >
                    #
                  </button>
                  <input
                    value={tag.name}
                    onChange={(e) => store.updateTag(tag.id, { name: e.target.value.replace(/^#/, "") })}
                    onBlur={(e) => !e.target.value.trim() && store.updateTag(tag.id, { name: "sem-nome" })}
                    aria-label="Nome da tag"
                    className="h-10 min-w-0 flex-1 rounded-lg bg-transparent px-2 font-medium outline-none focus:bg-muted"
                    style={{ color: tag.color }}
                  />
                  <span className="text-xs tabular-nums text-muted-foreground">{tagCount(tag.id)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmingTag === tag.id) {
                        store.deleteTag(tag.id);
                        setConfirmingTag(null);
                        onMessage(`Tag #${tag.name} excluída`);
                      } else setConfirmingTag(tag.id);
                    }}
                    onBlur={() => setConfirmingTag(null)}
                    className={cn(
                      "inline-flex h-10 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors",
                      confirmingTag === tag.id
                        ? "bg-destructive px-4 text-destructive-foreground"
                        : "w-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                    )}
                    aria-label={confirmingTag === tag.id ? `Confirmar exclusão de #${tag.name}` : `Excluir #${tag.name}`}
                  >
                    {confirmingTag === tag.id ? "Excluir?" : <Trash2 size={16} />}
                  </button>
                  {tagPalette === tag.id ? (
                    <div className="flex w-full flex-wrap gap-2 pb-2 pl-12" role="radiogroup" aria-label="Cor">
                      {TAG_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          role="radio"
                          aria-checked={tag.color === color}
                          aria-label={color}
                          onClick={() => {
                            store.updateTag(tag.id, { color });
                            setTagPalette(null);
                          }}
                          className={cn(
                            "size-8 rounded-full transition-transform hover:scale-110",
                            tag.color === color && "ring-2 ring-foreground ring-offset-2",
                          )}
                          style={{ background: color }}
                        />
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addTag();
            }}
          >
            <input
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              placeholder="Nova tag (ex.: urgente)"
              className="h-12 min-w-0 flex-1 rounded-2xl border border-border px-4 outline-none placeholder:text-muted-foreground/60 focus:border-foreground/40 focus:ring-2 focus:ring-ring/40"
            />
            <button
              type="submit"
              disabled={!tagName.trim()}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              <Plus size={16} />
              Adicionar
            </button>
          </form>
        </div>

        <div className="border-t border-border pt-4">
          <p className="mb-2 px-1 text-sm font-medium">Backup</p>
          <p className="mb-4 px-1 text-xs leading-4 text-muted-foreground">
            Suas tarefas ficam salvas neste aparelho. Exporte um arquivo para guardar ou levar para outro aparelho.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportBackup}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              <Download size={16} /> Exportar
            </button>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              <Upload size={16} /> Importar
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importBackup(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
