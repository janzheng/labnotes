import React, { useState, useEffect, useRef } from 'react'
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { ChevronRight, ChevronDown } from 'lucide-react'

// Define the props interface manually
interface ToggleBlockViewProps {
  node: any;
  getPos: () => number;
  editor: any;
  updateAttributes: (attrs: Record<string, any>) => void;
  extension: any;
  selected: boolean;
}

const ToggleBlockView: React.FC<ToggleBlockViewProps> = ({ 
  node, 
  getPos, 
  editor, 
  updateAttributes, 
  extension, 
  selected
}) => {
  const [isOpen, setIsOpen] = useState(node.attrs.open)
  const [title, setTitle] = useState(node.attrs.title || 'Toggle')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const titleDisplayRef = useRef<HTMLDivElement>(null)
  
  // Update the node's attributes when title or isOpen changes
  useEffect(() => {
    updateAttributes({ title, open: isOpen })
  }, [title, isOpen, updateAttributes])
  
  // Handle toggle action (only on chevron click)
  const handleToggleClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsOpen(!isOpen)
  }
  
  // Start editing the title
  const handleStartEditing = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsEditingTitle(true)
    
    // Focus the input in the next render cycle
    setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus()
        titleInputRef.current.select()
      }
    }, 10)
  }
  
  // Save the title and exit editing mode
  const handleSaveTitle = () => {
    if (titleInputRef.current) {
      const newTitle = titleInputRef.current.value || 'Toggle'
      setTitle(newTitle)
    }
    setIsEditingTitle(false)
  }
  
  // Handle key presses in the title input
  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveTitle()
      
      // Focus on the first content block if toggle is open
      if (isOpen) {
        setTimeout(() => {
          const pos = getPos() + 1 // Position of first content block
          editor.commands.setTextSelection(pos)
          editor.commands.focus()
        }, 10)
      }
    }
    
    if (e.key === 'Escape') {
      e.preventDefault()
      setIsEditingTitle(false)
      // Restore original title
      if (titleInputRef.current) {
        titleInputRef.current.value = title
      }
    }
    
    // Stop propagation to prevent editor shortcuts
    e.stopPropagation()
  }
  
  return (
    <NodeViewWrapper className="toggle-block-wrapper my-2">
      <div className={`toggle-block border border-muted rounded-md ${selected ? 'ring-2 ring-primary' : ''}`}>
        <div className="toggle-title flex items-center gap-1 p-2">
          {/* Chevron icon - only this toggles the dropdown */}
          <button 
            type="button"
            className="toggle-icon p-1 rounded hover:bg-muted/50 focus:outline-none"
            onClick={handleToggleClick}
            aria-expanded={isOpen}
          >
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          
          {/* Title - using an actual input when editing */}
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              className="toggle-title-input w-full bg-muted/30 px-2 py-0.5 rounded outline-none font-medium"
              defaultValue={title}
              onBlur={handleSaveTitle}
              onKeyDown={handleTitleKeyDown}
              onClick={(e) => e.stopPropagation()}
              // Prevent any editor events from reaching this input
              onKeyPress={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            />
          ) : (
            <div 
              ref={titleDisplayRef}
              className="toggle-summary font-medium px-2 py-0.5 cursor-pointer hover:bg-muted/20 rounded"
              onClick={handleStartEditing}
              onDoubleClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleStartEditing(e)
              }}
            >
              {title || 'Toggle'}
            </div>
          )}
        </div>
        
        {isOpen && (
          <div 
            className="toggle-content pl-6"
            onMouseEnter={(e) => {
              e.stopPropagation()
              // When mouse enters toggle content, hide parent toggle's drag handles
              const toggleBlock = e.currentTarget.closest('.toggle-block');
              if (toggleBlock) {
                // Find any drag handles that might be for the parent toggle
                const dragHandles = document.querySelectorAll('.novel-drag-handle, .novel-add-handle');
                
                dragHandles.forEach(handle => {
                  console.log('[toggle-block] mouse enter', toggleBlock)
                  const handleRect = handle.getBoundingClientRect();
                  const toggleRect = toggleBlock.getBoundingClientRect();
                  
                  // If the handle is at the same vertical position as the toggle header
                  if (Math.abs(handleRect.top - toggleRect.top) < 20) {
                    // Hide it
                    (handle as HTMLElement).style.display = 'none';
                  }
                });
              }
            }}
            onMouseLeave={(e) => {
              console.log('[toggle-block] mouse leave')
              // When mouse leaves toggle content, restore all drag handles
              const dragHandles = document.querySelectorAll('.novel-drag-handle, .novel-add-handle');
              dragHandles.forEach(handle => {
                (handle as HTMLElement).style.display = '';
              });
            }}
          >
            <NodeViewContent className="toggle-content-editable novel-toggle-content" />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default ToggleBlockView 