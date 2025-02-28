import { Extension } from "@tiptap/core";
import { Editor } from "@tiptap/react";
import { Node } from "@tiptap/pm/model";
import { Plugin, PluginKey, NodeSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import tippy from "tippy.js";
import type { Instance as TippyInstance } from "tippy.js";
import { Plus } from "lucide-react";
import { ReactRenderer } from "@tiptap/react";
import { EditorCommandOut } from "@/components/extensions/novel-src/components/editor-command";
import { suggestionItems } from "../slash-command";
import React from "react";

// Create a React component for the enhanced drag handle
const EnhancedDragHandleComponent = ({ editor, pos }: { editor: Editor; pos: number }) => {
  const handleAddBlock = () => {
    // Set the cursor position
    editor.commands.setNodeSelection(pos);
    
    // Trigger the slash command menu
    const event = new CustomEvent('novel:add-block', { 
      detail: { position: pos, timestamp: Date.now() } 
    });
    window.dispatchEvent(event);
  };

  const handleDragClick = () => {
    // Set the cursor position
    editor.commands.setNodeSelection(pos);
    
    // Create a tippy instance with the slash command menu
    const element = document.createElement('div');
    element.id = 'enhanced-drag-handle-menu';
    document.body.appendChild(element);
    
    // Create a ReactRenderer for the slash command menu
    const component = new ReactRenderer(EditorCommandOut, {
      props: {
        editor,
        items: suggestionItems,
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
        },
      },
      editor,
    });
    
    // Create a tippy instance
    const tippyInstance = tippy(document.body, {
      getReferenceClientRect: () => {
        const selection = editor.state.selection;
        const { from } = selection;
        const domRect = editor.view.coordsAtPos(from);
        return new DOMRect(domRect.left, domRect.top, 0, 0);
      },
      appendTo: () => document.body,
      content: component.element,
      showOnCreate: true,
      interactive: true,
      trigger: 'manual',
      placement: 'bottom-start',
      onHide() {
        component.destroy();
        tippyInstance.destroy();
      },
    });
    
    // Show the tippy instance
    tippyInstance.show();
  };

  return (
    <div className="enhanced-drag-handle">
      <button 
        className="enhanced-drag-handle-add" 
        onClick={handleAddBlock}
        title="Add block"
      >
        <Plus size={14} />
      </button>
      <button 
        className="enhanced-drag-handle-drag" 
        onClick={handleDragClick}
        title="Block menu"
      />
    </div>
  );
};

// Create the extension
export const EnhancedDragHandle = Extension.create({
  name: 'enhancedDragHandle',
  
  addOptions() {
    return {
      dragHandleWidth: 30,
      debug: true, // Enable debug mode
    };
  },
  
  onEditorReady({ editor }: { editor: Editor }) {
    console.log('EnhancedDragHandle: Editor is ready');
    
    // Force a re-render of the editor to ensure decorations are applied
    setTimeout(() => {
      editor.view.updateState(editor.view.state);
      console.log('EnhancedDragHandle: Forced editor update');
      
      // Add a class to the editor to enable our styles
      const editorElement = editor.view.dom;
      editorElement.classList.add('enhanced-drag-handle-enabled');
      
    }, 100);
  },
  
  addProseMirrorPlugins() {
    const { dragHandleWidth } = this.options;
    const editor = this.editor;
    const dragHandleKey = new PluginKey('enhancedDragHandle');
    
    console.log('EnhancedDragHandle: Adding ProseMirror plugins');
    
    // Use a simpler approach without React for the drag handle DOM elements
    return [
      new Plugin({
        key: dragHandleKey,
        props: {
          decorations(state) {
            const { doc } = state;
            const decorations: Decoration[] = [];
            
            // Add decorations for each block node
            doc.descendants((node, pos) => {
              if (node.isBlock && !node.isText) {
                console.log(`EnhancedDragHandle: Creating drag handle for node at position ${pos}`, node.type.name);
                
                const dom = document.createElement('div');
                dom.setAttribute('data-drag-handle', 'true');
                dom.setAttribute('data-pos', String(pos));
                
                // Create the drag handle UI with plain DOM
                const handleContainer = document.createElement('div');
                handleContainer.className = 'enhanced-drag-handle';
                
                // Add button
                const addButton = document.createElement('button');
                addButton.className = 'enhanced-drag-handle-add';
                addButton.title = 'Add block';
                addButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
                addButton.addEventListener('click', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  console.log(`EnhancedDragHandle: Add button clicked at position ${pos}`);
                  
                  // Set the cursor position
                  editor.commands.setNodeSelection(pos);
                  
                  // Trigger the slash command menu
                  const event = new CustomEvent('novel:add-block', { 
                    detail: { position: pos, timestamp: Date.now() } 
                  });
                  window.dispatchEvent(event);
                });
                
                // Drag handle button
                const dragButton = document.createElement('button');
                dragButton.className = 'enhanced-drag-handle-drag';
                dragButton.title = 'Block menu';
                dragButton.addEventListener('click', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  console.log(`EnhancedDragHandle: Drag button clicked at position ${pos}`);
                  
                  // Set the cursor position
                  editor.commands.setNodeSelection(pos);
                  
                  // Create a tippy instance with the slash command menu
                  const element = document.createElement('div');
                  element.id = 'enhanced-drag-handle-menu';
                  document.body.appendChild(element);
                  
                  // Create a ReactRenderer for the slash command menu
                  const component = new ReactRenderer(EditorCommandOut, {
                    props: {
                      editor,
                      items: suggestionItems,
                      command: ({ editor, range, props }: any) => {
                        props.command({ editor, range });
                      },
                    },
                    editor,
                  });
                  
                  // Create a tippy instance
                  const tippyInstance = tippy(document.body, {
                    getReferenceClientRect: () => {
                      const selection = editor.state.selection;
                      const { from } = selection;
                      const domRect = editor.view.coordsAtPos(from);
                      return new DOMRect(domRect.left, domRect.top, 0, 0);
                    },
                    appendTo: () => document.body,
                    content: component.element,
                    showOnCreate: true,
                    interactive: true,
                    trigger: 'manual',
                    placement: 'bottom-start',
                    onHide() {
                      component.destroy();
                      tippyInstance.destroy();
                    },
                  });
                  
                  // Show the tippy instance
                  tippyInstance.show();
                });
                
                // Append buttons to container
                handleContainer.appendChild(addButton);
                handleContainer.appendChild(dragButton);
                
                // Append container to drag handle
                dom.appendChild(handleContainer);
                
                decorations.push(
                  Decoration.widget(pos, dom, {
                    key: `drag-handle-${pos}`,
                    side: -1,
                  })
                );
              }
              
              return true;
            });
            
            console.log(`EnhancedDragHandle: Created ${decorations.length} drag handles`);
            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

// Add CSS for the enhanced drag handle
const style = document.createElement('style');
style.textContent = `
  .enhanced-drag-handle-enabled {
    position: relative;
    margin-left: 30px; /* Make space for the drag handle */
    padding-left: 5px; /* Add some padding */
  }

  .enhanced-drag-handle {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    opacity: 0.7; /* Make it more visible by default */
    transition: opacity 0.2s;
    z-index: 50;
    width: 100%;
  }
  
  .enhanced-drag-handle:hover {
    opacity: 1;
  }
  
  .enhanced-drag-handle-add {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background-color: #e2e8f0;
    border: none;
    cursor: pointer;
    margin-bottom: 6px;
    color: #64748b;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  
  .enhanced-drag-handle-add:hover {
    background-color: #cbd5e1;
    color: #475569;
    transform: scale(1.1);
    transition: transform 0.2s;
  }
  
  .enhanced-drag-handle-drag {
    width: 24px;
    height: 24px;
    border-radius: 3px;
    background-color: #f1f5f9;
    border: none;
    cursor: grab;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10' style='fill: rgba(0, 0, 0, 0.5)'%3E%3Cpath d='M3,2 C2.44771525,2 2,1.55228475 2,1 C2,0.44771525 2.44771525,0 3,0 C3.55228475,0 4,0.44771525 4,1 C4,1.55228475 3.55228475,2 3,2 Z M3,6 C2.44771525,6 2,5.55228475 2,5 C2,4.44771525 2.44771525,4 3,4 C3.55228475,4 4,4.44771525 4,5 C4,5.55228475 3.55228475,6 3,6 Z M3,10 C2.44771525,10 2,9.55228475 2,9 C2,8.44771525 2.44771525,8 3,8 C3.55228475,8 4,8.44771525 4,9 C4,9.55228475 3.55228475,10 3,10 Z M7,2 C6.44771525,2 6,1.55228475 6,1 C6,0.44771525 6.44771525,0 7,0 C7.55228475,0 8,0.44771525 8,1 C8,1.55228475 7.55228475,2 7,2 Z M7,6 C6.44771525,6 6,5.55228475 6,5 C6,4.44771525 6.44771525,4 7,4 C7.55228475,4 8,4.44771525 8,5 C8,5.55228475 7.55228475,6 7,6 Z M7,10 C6.44771525,10 6,9.55228475 6,9 C2,8.44771525 6.44771525,8 7,8 C7.55228475,8 8,8.44771525 8,9 C8,9.55228475 7.55228475,10 7,10 Z'%3E%3C/path%3E%3C/svg%3E");
    background-size: 100% 100%;
    background-repeat: no-repeat;
    background-position: center;
  }
  
  .enhanced-drag-handle-drag:hover {
    background-color: #e2e8f0;
    transform: scale(1.1);
    transition: transform 0.2s;
  }
  
  .enhanced-drag-handle-drag:active {
    cursor: grabbing;
    background-color: #cbd5e1;
  }

  /* Make the drag handle visible when hovering over the block */
  [data-drag-handle="true"] {
    position: absolute;
    left: -30px;
    top: 0;
    height: 100%;
    width: 30px;
    opacity: 1;
    transition: opacity 0.2s;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(241, 245, 249, 0.3);
  }

  [data-drag-handle="true"]:hover {
    background-color: rgba(241, 245, 249, 0.7);
  }

  /* Responsive styles */
  @media screen and (max-width: 600px) {
    .enhanced-drag-handle-enabled {
      margin-left: 0;
    }
    
    [data-drag-handle="true"] {
      display: none;
    }
  }
`;

// Make sure the style is added to the document
document.addEventListener('DOMContentLoaded', () => {
  document.head.appendChild(style);
});

// Also add it immediately in case the DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  document.head.appendChild(style);
}

export default EnhancedDragHandle; 