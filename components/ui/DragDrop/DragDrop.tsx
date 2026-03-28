'use client'

import { useState, useRef, ReactNode } from 'react'
import styles from './DragDrop.module.css'

interface DragItem {
  id: string
  content: ReactNode
}

interface DropZone {
  id: string
  label?: string
  acceptId?: string
}

interface DragDropProps {
  items: DragItem[]
  zones: DropZone[]
  onDrop: (itemId: string, zoneId: string) => void
  feedback?: Record<string, 'correct' | 'try-again' | 'idle'>
}

export function DragDrop({ items, zones, onDrop, feedback = {} }: DragDropProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [droppedItems, setDroppedItems] = useState<Record<string, string>>({})
  const dragRef = useRef<string | null>(null)

  function handleDragStart(itemId: string) {
    setDraggedId(itemId)
    dragRef.current = itemId
  }

  function handleDragEnd() {
    setDraggedId(null)
    dragRef.current = null
  }

  function handleDrop(zoneId: string) {
    const itemId = dragRef.current
    if (!itemId) return

    setDroppedItems((prev) => ({ ...prev, [zoneId]: itemId }))
    onDrop(itemId, zoneId)
    setDraggedId(null)
    dragRef.current = null
  }

  const availableItems = items.filter(
    (item) => !Object.values(droppedItems).includes(item.id)
  )

  return (
    <div className={styles.container}>
      <div className={styles.items} role="list" aria-label="Элементы для перетаскивания">
        {availableItems.map((item) => (
          <div
            key={item.id}
            className={`${styles.item} ${draggedId === item.id ? styles.dragging : ''}`}
            draggable
            onDragStart={() => handleDragStart(item.id)}
            onDragEnd={handleDragEnd}
            onTouchStart={() => handleDragStart(item.id)}
            role="listitem"
          >
            {item.content}
          </div>
        ))}
      </div>

      <div className={styles.zones} role="list" aria-label="Зоны для размещения">
        {zones.map((zone) => {
          const droppedItemId = droppedItems[zone.id]
          const droppedItem = items.find((i) => i.id === droppedItemId)
          const state = feedback[zone.id] ?? 'idle'

          return (
            <div
              key={zone.id}
              className={`${styles.zone} ${styles[state]} ${draggedId ? styles.accepting : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(zone.id)}
              role="listitem"
              aria-label={zone.label}
            >
              {droppedItem ? (
                <span className={styles.placed}>{droppedItem.content}</span>
              ) : (
                <span className={styles.placeholder}>{zone.label}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
