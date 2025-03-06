import React, { useEffect, useRef } from 'react'
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'

// Define the props interface
interface DetailsBlockViewProps {
  node: any;
  getPos: () => number;
  editor: any;
  updateAttributes: (attrs: Record<string, any>) => void;
  extension: any;
  selected: boolean;
}

const DetailsBlockView: React.FC<DetailsBlockViewProps> = ({ 
  node, 
  getPos, 
  editor, 
  updateAttributes, 
  extension, 
  selected
}) => {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  
  // Sync the open state from node attributes to the DOM
  useEffect(() => {
    if (detailsRef.current) {
      detailsRef.current.open = !!node.attrs.open
    }
  }, [node.attrs.open])
  
  // Sync the open state from DOM to node attributes when user toggles
  const handleToggle = (event) => {
    if (detailsRef.current) {
      updateAttributes({ open: detailsRef.current.open })
    }
  }
  
  return (
    <NodeViewWrapper className="details-block-wrapper my-2">
      <details
        ref={detailsRef}
        className={`details-block border border-muted rounded-md ${selected ? 'ring-2 ring-primary' : ''}`}
        onToggle={handleToggle}
        open={node.attrs.open}
      >
        {/* The summary node will be rendered here automatically */}
        <div className="details-content pl-6 py-2">
          {/* This will contain all nodes except the summary */}
          <NodeViewContent className="details-content-editable" />
        </div>
      </details>
    </NodeViewWrapper>
  )
}

export default DetailsBlockView 