import React, { useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { Plus, Edit2, Trash2, GripVertical } from 'lucide-react';
import { ReportType } from '../lib/reportTypeService';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TypeItemProps {
  type: ReportType;
  onEdit: (type: ReportType) => void;
  onDelete: (type: ReportType) => void;
}

function TypeItem({ type, onEdit, onDelete }: TypeItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: type.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-4 p-4 bg-white rounded-lg border shadow-sm
        ${isDragging ? 'border-[#f15922]' : 'border-gray-200'}
      `}
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={20} />
      </button>
      
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-gray-900">{type.name}</h3>
        {type.description && (
          <p className="text-sm text-gray-500 truncate">{type.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onEdit(type)}
          className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded"
          title="Modifier"
        >
          <Edit2 size={18} />
        </button>
        <button
          onClick={() => onDelete(type)}
          className="p-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded"
          title="Supprimer"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}

interface TypeManagerProps {
  types: ReportType[];
  onAdd: () => void;
  onEdit: (type: ReportType) => void;
  onDelete: (type: ReportType) => void;
  onReorder: (types: ReportType[]) => void;
}

export function TypeManager({ types, onAdd, onEdit, onDelete, onReorder }: TypeManagerProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = types.findIndex(type => type.id === active.id);
      const newIndex = types.findIndex(type => type.id === over.id);
      
      onReorder(arrayMove(types, oldIndex, newIndex));
    }

    setActiveId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">Types de Rapport</h3>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-3 py-2 bg-[#f15922] text-white rounded-lg hover:bg-[#f15922]/90 transition-colors"
        >
          <Plus size={18} />
          <span>Nouveau Type</span>
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext
          items={types}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {types.map(type => (
              <TypeItem
                key={type.id}
                type={type}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {types.length === 0 && (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
          Aucun type défini
        </div>
      )}
    </div>
  );
}