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
  const toggleRef = useRef<HTMLDivElement>(null)
  
  // Update the node's attributes when isOpen changes
  useEffect(() => {
    updateAttributes({ open: isOpen })
  }, [isOpen, updateAttributes])
  
  // Handle toggle action (only on chevron click)
  const handleToggleClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsOpen(!isOpen)
  }
  
  // Handle click on the overall toggle header area
  const handleToggleHeaderClick = (e) => {
    // Toggle open/closed state when clicking anywhere in the header
    // except when clicking inside the content itself
    if (!e.target.closest('.toggle-summary-content')) {
      setIsOpen(!isOpen)
      e.preventDefault()
      e.stopPropagation()
    }
  }
  
  // Improve keyboard navigation
  const handleKeyDown = (e) => {
    // Handle space or enter to toggle open/close
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      setIsOpen(!isOpen)
    }
  }
  
  return (
    <NodeViewWrapper className="toggle-block-wrapper my-2" data-type="toggle-block-wrapper">
      <div 
        ref={toggleRef}
        className={`toggle-block border border-muted rounded-md ${selected ? 'ring-2 ring-primary' : ''}`}
        data-node-type="toggleBlock"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* The header area containing the first content block */}
        <div 
          className="toggle-title flex items-center gap-1 p-2"
          data-testid="toggle-header"
        >
          {/* Button containing both chevron and summary */}
          <button 
            type="button"
            className="cursor-pointer toggle-icon w-full flex items-center gap-2 p-1 rounded hover:bg-muted/50 focus:outline-none text-left"
            onClick={handleToggleClick}
            aria-expanded={isOpen}
          >
            {/* Chevron icon */}
            <span className="flex-shrink-0">
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
            
            {/* Summary content inside the button */}
            <div className="toggle-summary w-full font-medium">
              <div className="toggle-summary-content" data-summary="true">
                {node.content.firstChild && node.content.firstChild.textContent || 'Toggle'}
              </div>
            </div>
          </button>
        </div>
        
        {/* The expandable content area with all content */}
        {isOpen && (
          <div className="toggle-content px-6 pb-4 mt-1 border-t border-muted/50">
            <NodeViewContent 
              className="toggle-content-editable novel-toggle-content" 
              data-content="true"
            />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default ToggleBlockView 