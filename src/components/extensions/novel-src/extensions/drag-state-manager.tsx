import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// Event types for our drag system
export type DragEventType = 
  | 'dragstart' 
  | 'dragend' 
  | 'dragupdate'
  | 'drop'
  | 'nodedrag';

// Interface for our drag events - renamed to avoid collision with browser's DragEvent
export interface NovelDragEvent {
  type: DragEventType;
  position?: number;
  node?: any;
  dragging: boolean;
}

// Custom event name
export const DRAG_EVENT_NAME = 'novel:drag-state-update';

// Plugin key for accessing the plugin state
export const dragStateKey = new PluginKey('dragStateManager');

// Helper to dispatch drag events
export function dispatchDragEvent(type: DragEventType, position?: number, node?: any) {
  const event = new CustomEvent(DRAG_EVENT_NAME, {
    detail: {
      type,
      position,
      node,
      dragging: type === 'dragstart' || type === 'nodedrag',
    },
    bubbles: true
  });
  
  document.dispatchEvent(event);
  window.dispatchEvent(event);
}

// The actual plugin
function DragStatePlugin() {
  return new Plugin({
    key: dragStateKey,
    state: {
      init() {
        return {
          dragging: false,
          position: null,
          node: null,
        };
      },
      apply(tr, state) {
        // Check for drag metadata in the transaction
        const meta = tr.getMeta(dragStateKey);
        if (meta) {
          return {
            ...state,
            ...meta,
          };
        }
        return state;
      },
    },
    props: {
      handleDOMEvents: {
        dragstart: (view, event) => {
          view.dom.classList.add('dragging');
          
          // Update plugin state
          view.dispatch(view.state.tr.setMeta(dragStateKey, { 
            dragging: true,
            position: view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos,
          }));
          
          // Dispatch our custom event
          dispatchDragEvent('dragstart', 
            view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos);
            
          return false; // Let other handlers process it too
        },
        dragend: (view) => {
          view.dom.classList.remove('dragging');
          
          // Update plugin state
          view.dispatch(view.state.tr.setMeta(dragStateKey, { 
            dragging: false,
            position: null,
          }));
          
          // Dispatch our custom event
          dispatchDragEvent('dragend');
          
          return false; // Let other handlers process it too
        },
        drop: (view) => {
          view.dom.classList.remove('dragging');
          
          // Update plugin state
          view.dispatch(view.state.tr.setMeta(dragStateKey, { 
            dragging: false,
            position: null,
          }));
          
          // Dispatch our custom event
          dispatchDragEvent('drop');
          
          return false; // Let other handlers process it too
        },
      },
    },
    view: () => {
      // Set up a mutation observer to watch for dragging classes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && 
              mutation.attributeName === 'class' && 
              mutation.target instanceof Element) {
            
            const target = mutation.target;
            const isDragging = 
              target.classList.contains('ProseMirror-selectednode') || 
              target.classList.contains('dragging');
            
            if (isDragging) {
              dispatchDragEvent('nodedrag');
            }
          }
        });
      });
      
      // Start observing the document
      setTimeout(() => {
        const editor = document.querySelector('.ProseMirror');
        if (editor) {
          observer.observe(editor, { 
            attributes: true,
            attributeFilter: ['class'],
            subtree: true
          });
        }
      }, 100);
      
      return {
        destroy: () => {
          observer.disconnect();
        },
      };
    },
  });
}

// The extension to add to tiptap
export const DragStateManager = Extension.create({
  name: 'dragStateManager',
  
  addProseMirrorPlugins() {
    return [DragStatePlugin()];
  },
});

// Helper function to check if dragging from plugin state
export function isDraggingActive(state) {
  const pluginState = dragStateKey.getState(state);
  return pluginState?.dragging || false;
}

// Helper to add drag event listener - updated to use the renamed interface
export function addDragEventListener(callback: (event: NovelDragEvent) => void) {
  const listener = (e: Event) => {
    if (e instanceof CustomEvent && e.type === DRAG_EVENT_NAME) {
      callback(e.detail);
    }
  };
  
  document.addEventListener(DRAG_EVENT_NAME, listener);
  
  // Return a cleanup function
  return () => {
    document.removeEventListener(DRAG_EVENT_NAME, listener);
  };
}

// Make sure our NovelDragEvent interface is exported
export type { NovelDragEvent }; 