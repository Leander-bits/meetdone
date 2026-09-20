"use client";
import { type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useI18n } from "./language-provider";
import { ItemNumber } from "./requirement-controls";

export function SortableList({
  ids,
  onMove,
  children,
}: {
  ids: string[];
  onMove: (from: number, to: number) => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        screenReaderInstructions: {
          draggable: t(
            "Press Space to pick up, arrow keys to move, Space to drop, or Escape to cancel.",
          ),
        },
        announcements: {
          onDragStart: () => t("Item picked up."),
          onDragOver: ({ over }) =>
            over ? `${t("Position")} ${ids.indexOf(String(over.id)) + 1}` : undefined,
          onDragEnd: () => t("Item dropped."),
          onDragCancel: () => t("Reordering cancelled."),
        },
      }}
      onDragEnd={({ active, over }) => {
        if (over && active.id !== over.id) {
          const from = ids.indexOf(String(active.id));
          const to = ids.indexOf(String(over.id));
          if (from >= 0 && to >= 0) onMove(from, to);
        }
      }}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

export function SortableRow({
  id,
  index,
  children,
  flow = false,
}: {
  id: string;
  index: number;
  children: ReactNode;
  flow?: boolean;
}) {
  const { t } = useI18n();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      data-sortable={id}
      data-dragging={isDragging || undefined}
      data-drag-over={isOver || undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative min-w-0 ${flow ? "speaker-flow-item" : "rounded-lg border bg-white p-3"} ${isDragging ? "z-20 rounded-lg bg-primary/5 ring-2 ring-primary opacity-80" : isOver ? "rounded-lg border-primary bg-primary/5" : "border-border"}`}
    >
      <div className={flow ? "flex flex-col items-center" : "flex items-start gap-2"}>
        <div className="flex shrink-0 items-start gap-1">
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`${t("Drag to reorder")} ${index + 1}`}
            title={t("Drag to reorder")}
            className="flex h-9 w-7 touch-none items-center justify-center rounded cursor-grab text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing"
            data-drag-handle
          >
            <GripVertical size={16} />
          </button>
          <ItemNumber index={index} />
        </div>
        <div className={flow ? "w-full min-w-0" : "min-w-0 flex-1"}>{children}</div>
      </div>
    </div>
  );
}
