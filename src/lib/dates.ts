/** Utilitários de data em pt-BR. Datas de prazo são strings YYYY-MM-DD (sem fuso). */

export function toISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromISODate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Próxima ocorrência do dia da semana (0 = domingo). Hoje não conta. */
export function nextWeekday(weekday: number) {
  const today = startOfToday();
  const diff = (weekday - today.getDay() + 7) % 7 || 7;
  return addDays(today, diff);
}

/** Dias entre hoje e a data (negativo = atrasada). */
export function daysFromToday(value: string) {
  const ms = fromISODate(value).getTime() - startOfToday().getTime();
  return Math.round(ms / 86_400_000);
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export type DueTone = "overdue" | "today" | "soon" | "later";

export function describeDue(value: string): { label: string; tone: DueTone } {
  const diff = daysFromToday(value);
  const date = fromISODate(value);
  if (diff < -1) return { label: `Atrasada · ${formatShort(date)}`, tone: "overdue" };
  if (diff === -1) return { label: "Ontem", tone: "overdue" };
  if (diff === 0) return { label: "Hoje", tone: "today" };
  if (diff === 1) return { label: "Amanhã", tone: "soon" };
  if (diff < 7) return { label: capitalize(WEEKDAYS[date.getDay()]), tone: "soon" };
  return { label: formatShort(date), tone: "later" };
}

export function formatShort(date: Date) {
  return date
    .toLocaleDateString("pt-BR", { day: "numeric", month: "short" })
    .replace(".", "");
}

export function formatLong(date: Date) {
  return capitalize(
    date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }),
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function quickDates() {
  const today = startOfToday();
  return [
    { label: "Hoje", value: toISODate(today) },
    { label: "Amanhã", value: toISODate(addDays(today, 1)) },
    { label: "Sexta", value: toISODate(nextWeekday(5)) },
    { label: "Segunda", value: toISODate(nextWeekday(1)) },
  ];
}
