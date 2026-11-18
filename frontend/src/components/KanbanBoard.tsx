"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { createId, moveCard, type BoardData } from "@/lib/kanban";

type Props = {
  board: BoardData;
  onChange: (board: BoardData) => void;
  locked?: boolean;
};

export function KanbanBoard({ board, onChange, locked = false }: Props) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 6 },
  }));

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveCardId(null);
    if (locked || !over || active.id === over.id) return;
    const columns = moveCard(board.columns, String(active.id), String(over.id));
    if (columns !== board.columns) onChange({ ...board, columns });
  }

  function renameColumn(columnId: string, title: string) {
    onChange({
      ...board,
      columns: board.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    });
  }

  function addCard(columnId: string, title: string, details: string) {
    const id = createId("card");
    onChange({
      cards: { ...board.cards, [id]: { id, title, details } },
      columns: board.columns.map((column) =>
        column.id === columnId ? { ...column, cardIds: [...column.cardIds, id] } : column
      ),
    });
  }

  function deleteCard(columnId: string, cardId: string) {
    onChange({
      cards: Object.fromEntries(Object.entries(board.cards).filter(([id]) => id !== cardId)),
      columns: board.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: column.cardIds.filter((id) => id !== cardId) }
          : column
      ),
    });
  }

  function editCard(cardId: string, title: string, details: string) {
    const card = board.cards[cardId];
    if (card.title === title && card.details === details) return;
    onChange({ ...board, cards: { ...board.cards, [cardId]: { id: cardId, title, details } } });
  }

  const activeCard = activeCardId ? board.cards[activeCardId] : null;

  return (
    <fieldset disabled={locked} className="min-w-0 overflow-x-auto pb-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={({ active }) => setActiveCardId(String(active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveCardId(null)}
      >
        <div className="grid grid-cols-[repeat(5,minmax(10.75rem,1fr))] gap-3">
          {board.columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              cards={column.cardIds.map((cardId) => board.cards[cardId])}
              onRename={renameColumn}
              onAddCard={addCard}
              onDeleteCard={deleteCard}
              onEditCard={editCard}
              locked={locked}
            />
          ))}
        </div>
        <DragOverlay>
          {activeCard && <div className="w-[180px]"><KanbanCardPreview card={activeCard} /></div>}
        </DragOverlay>
      </DndContext>
    </fieldset>
  );
}
