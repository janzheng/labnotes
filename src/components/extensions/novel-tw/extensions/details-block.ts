import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import DetailsBlockView from '../ui/details-block-view'

export interface DetailsBlockOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    detailsBlock: {
      /**
       * Create a details block with summary
       */
      setDetailsBlock: (summaryText?: string) => ReturnType
      /**
       * Convert current block to details block
       */
      toggleDetailsBlock: () => ReturnType
      /**
       * Toggle the open/closed state of a details block
       */
      toggleDetailsOpenState: () => ReturnType
    }
  }
}

export const DetailsBlock = Node.create<DetailsBlockOptions>({
  name: 'detailsBlock',
  
  group: 'block',
  
  // It contains exactly one summary node followed by one or more blocks
  content: 'summaryNode block+',
  
  defining: true,
  
  // Make it draggable
  draggable: true,
  
  // Select the whole node
  selectable: true,
  
  // Track open/closed state
  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: element => element.hasAttribute('open'),
        renderHTML: attributes => {
          return attributes.open ? { open: 'open' } : {}
        },
      },
    }
  },
  
  addOptions() {
    return {
      HTMLAttributes: {
        class: 'details-block',
      },
    }
  },
  
  parseHTML() {
    return [
      {
        tag: 'details',
      },
    ]
  },
  
  renderHTML({ HTMLAttributes }) {
    return [
      'details', 
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0
    ]
  },
  
  addNodeView() {
    return ReactNodeViewRenderer(DetailsBlockView)
  },
  
  addCommands() {
    return {
      setDetailsBlock: (summaryText = 'Details') => ({ commands, chain, editor, state }) => {
        // Get the current node
        const { $from, $to } = state.selection
        const range = $from.blockRange($to)
        
        if (!range) return false
        
        // Get current block text to use as summary if available
        const currentNodeText = $from.parent.textContent || summaryText
        
        return chain()
          .deleteRange({ from: range.start, to: range.end })
          .insertContent({
            type: 'detailsBlock',
            attrs: { open: true },
            content: [
              { 
                type: 'summaryNode',
                content: [
                  { 
                    type: 'text',
                    text: currentNodeText 
                  }
                ]
              },
              { 
                type: 'paragraph' 
              }
            ]
          })
          .run()
      },
      
      toggleDetailsBlock: () => ({ commands, state }) => {
        const { $from, $to } = state.selection
        const range = $from.blockRange($to)
        
        if (!range) return false
        
        const isInDetailsBlock = this.isActive(state)
        
        if (isInDetailsBlock) {
          // Lift the content out of the details block
          return commands.lift(this.name)
        }
        
        // Convert to details block
        return commands.setDetailsBlock()
      },
      
      toggleDetailsOpenState: () => ({ tr, state, dispatch }) => {
        const { $from } = state.selection
        let node = $from.node($from.depth)
        let pos = $from.before($from.depth)
        
        // Find detailsBlock node if we're not directly in it
        if (node.type.name !== 'detailsBlock') {
          for (let d = $from.depth; d > 0; d--) {
            node = $from.node(d)
            if (node.type.name === 'detailsBlock') {
              pos = $from.before(d)
              break
            }
          }
        }
        
        if (node.type.name !== 'detailsBlock') {
          return false
        }
        
        if (dispatch) {
          tr.setNodeAttribute(pos, 'open', !node.attrs.open)
          dispatch(tr)
        }
        
        return true
      }
    }
  },
  
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-d': () => this.editor.commands.toggleDetailsBlock(),
      // Add Space to toggle between open/closed when toggle is selected
      'Space': () => {
        const { state } = this.editor
        const { selection } = state
        
        // Check if the selection is on a details block
        if (selection.$from.parent.type.name === 'detailsBlock') {
          return this.editor.commands.toggleDetailsOpenState()
        }
        
        return false
      }
    }
  },
})

export default DetailsBlock 