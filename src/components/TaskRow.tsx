import { CalendarDays, FileText, UserRound } from "lucide-react";
import { Checkbox } from "@/components/motion/checkbox";
import {
  SortableListHandle,
  SortableListItem,
  SortableListItemContent,
} from "@/components/motion/sortable-list";
import { describeDue, type DueTone } from "@/lib/dates";
import type { Context, Task } from "@/lib/store";
import { cn } from "@/lib/utils";

const DUE_CLASS: Record<DueTone, string> = {
  overdue: "bg-destructive/10 text-destructive",
  today: "bg-primary-soft text-primary",
  soon: "bg-muted text-foreground",
  later: "bg-muted text-muted-foreground",
};

type MetaProps = { task: Task; context?: Context; showContext?: boolean };

export function TaskMeta({ task, context, showContext }: MetaProps) {
  const due = task.due ? describeDue(task.due) : null;
  const hasMeta = due || task.requester || task.notes || (showContext && context);
  if (!hasMeta) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
      {showContext && context ? (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: context.color }} />
          {context.name}
        </span>
      ) : null}
      {due ? (
        <span
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded-full px-2 font-medium",
            task.done ? "bg-muted text-muted-foreground" : DUE_CLASS[due.tone],
          )}
        >
          <CalendarDays size={12} aria-hidden />
          {due.label}
        </span>
      ) : null}
      {task.requester ? (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <UserRound size={12} aria-hidden />
          {task.requester}
        </span>
      ) : null}
      {task.notes ? (
        <span className="inline-flex items-center text-muted-foreground" title="Tem anotações">
          <FileText size={12} aria-label="Tem anotações" />
        </span>
      ) : null}
    </div>
  );
}

type RowProps = {
  task: Task;
  context?: Context;
  showContext?: boolean;
  completing?: boolean;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
};

/** Linha arrastável (lista de pendentes). */
export function SortableTaskRow({ task, context, showContext, completing, onToggle, onOpen }: RowProps) {
  return (
    <SortableListItem
      id={task.id}
      className={cn(
        "gap-0 rounded-2xl border-border bg-card p-0 pr-2 transition-opacity duration-300",
        completing && "opacity-50",
      )}
    >
      <SortableListHandle
        className="h-14 w-8 rounded-l-2xl rounded-r-none text-muted-foreground/60 hover:bg-transparent"
        aria-label={`Arrastar "${task.title}" para mudar a prioridade`}
      />
      <Checkbox
        checked={task.done || !!completing}
        onCheckedChange={() => onToggle(task)}
        aria-label={`Concluir "${task.title}"`}
        className="size-10 shrink-0 justify-center"
      />
      <SortableListItemContent>
        <button
          type="button"
          onClick={() => onOpen(task)}
          className="block w-full rounded-lg py-3 pl-2 pr-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className={cn(
              "block text-[15px] leading-6 font-medium text-foreground break-words",
              completing && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </span>
          <TaskMeta task={task} context={context} showContext={showContext} />
        </button>
      </SortableListItemContent>
    </SortableListItem>
  );
}

/** Linha simples para tarefas concluídas. */
export function DoneTaskRow({ task, onToggle, onOpen }: Omit<RowProps, "context" | "completing">) {
  return (
    <li className="flex items-center gap-0 rounded-2xl pl-8 pr-2">
      <Checkbox
        checked
        onCheckedChange={() => onToggle(task)}
        aria-label={`Reabrir "${task.title}"`}
        className="size-10 shrink-0 justify-center"
      />
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="min-w-0 flex-1 rounded-lg py-2 pl-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="block truncate text-[15px] leading-6 text-muted-foreground line-through decoration-muted-foreground/50">
          {task.title}
        </span>
      </button>
    </li>
  );
}
