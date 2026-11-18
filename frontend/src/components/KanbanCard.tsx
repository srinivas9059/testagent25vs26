import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { useState, type FormEvent } from "react";
import type { Card } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onEdit: (cardId: string, title: string, details: string) => void;
  locked: boolean;
};

export const KanbanCard = ({ card, onDelete, onEdit, locked }: KanbanCardProps) => {
  const [editing, setEditing] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, disabled: locked || editing });

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title")).trim();
    if (!title) return;
    onEdit(card.id, title, String(data.get("details")).trim());
    setEditing(false);
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "rounded-xl bg-white p-3 shadow-sm [overflow-wrap:anywhere]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...(!editing && attributes)}
      {...(!editing && listeners)}
      data-testid={`card-${card.id}`}
    >
      {editing ? (
        <form onSubmit={save} className="grid gap-2 text-sm">
          <label className="grid gap-1">Card title
            <input name="title" defaultValue={card.title} required
              className="w-full rounded-lg border border-slate-300 px-2 py-1" />
          </label>
          <label className="grid gap-1">Card details
            <textarea name="details" defaultValue={card.details} rows={3}
              className="w-full rounded-lg border border-slate-300 px-2 py-1" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="rounded-lg bg-[var(--secondary-purple)] px-2 py-1 font-semibold text-white">Save card</button>
            <button type="button" onClick={() => setEditing(false)} className="px-1 py-1">Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <h4 className="font-display text-base font-semibold text-[var(--navy-dark)]">
            {card.title}
          </h4>
          {card.details && <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
            {card.details}
          </p>}
          <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
            <button type="button" onClick={() => setEditing(true)} aria-label={`Edit ${card.title}`}
              className="text-[var(--secondary-purple)] hover:underline">Edit</button>
            <button type="button" onClick={() => onDelete(card.id)} aria-label={`Delete ${card.title}`}
              className="text-slate-600 hover:underline">Remove</button>
          </div>
        </>
      )}
    </article>
  );
};
