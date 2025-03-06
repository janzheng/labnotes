import React, { useState } from 'react'
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
  children?: React.ReactNode;
}

const ToggleBlockView: React.FC<ToggleBlockViewProps> = ({ 
  node, 
  getPos, 
  editor, 
  updateAttributes, 
  extension, 
  selected
}) => {
  const [isOpen, setIsOpen] = useState(false)
  
  // Get the first child as the summary
  const firstChild = node.content?.firstChild
  const summaryContent = firstChild ? firstChild.textContent : 'Toggle'
  
  return (
    <NodeViewWrapper className="toggle-block-wrapper my-2">
      <div className={`toggle-block border border-muted rounded-md ${selected ? 'ring-2 ring-primary' : ''}`}>
        <div 
          className="flex items-center gap-1 p-2 cursor-pointer hover:bg-muted/50"
          onClick={() => setIsOpen(!isOpen)}
          role="button"
          aria-expanded={isOpen}
        >
          <span className="toggle-icon">
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          <div className="toggle-summary font-medium">{summaryContent}</div>
        </div>
        
        {isOpen && (
          <div className="toggle-content pl-6">
            {/* This is the key component that makes child content editable */}
            <NodeViewContent className="toggle-content-editable" />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default ToggleBlockView 