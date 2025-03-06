import { mergeAttributes, Node } from '@tiptap/core'

export interface SummaryNodeOptions {
  HTMLAttributes: Record<string, any>
}

export const SummaryNode = Node.create<SummaryNodeOptions>({
  name: 'summaryNode',
  
  // Summary can only be placed inside a detailsBlock
  group: 'block',
  
  // Summary content can include text and inline marks
  content: 'inline*',
  
  // This node can be selected directly
  selectable: true,
  
  // Prevent this node from being dragged alone
  draggable: false,
  
  // Define default options
  addOptions() {
    return {
      HTMLAttributes: {
        class: 'summary-node',
      },
    }
  },
  
  // Parse summary tag from HTML
  parseHTML() {
    return [
      {
        tag: 'summary',
      },
    ]
  },
  
  // Render as a summary element
  renderHTML({ HTMLAttributes }) {
    return [
      'summary', 
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0
    ]
  },
})

export default SummaryNode 