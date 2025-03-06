import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import ToggleBlockView from '../ui/toggle-block-view'

export interface ToggleBlockOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggleBlock: {
      /**
       * Create a toggle block with empty content
       */
      setToggleBlock: (title?: string) => ReturnType
      /**
       * Convert current block to toggle block
       */
      toggleToggleBlock: () => ReturnType
    }
  }
}

export const ToggleBlock = Node.create<ToggleBlockOptions>({
  name: 'toggleBlock',
  
  group: 'block',
  
  // Define attributes for the toggle block
  addAttributes() {
    return {
      // Store the toggle title as an attribute
      title: {
        default: 'Toggle',
        parseHTML: element => element.getAttribute('data-title') || 'Toggle',
        renderHTML: attributes => {
          return {
            'data-title': attributes.title,
          }
        },
      },
      // Track open/closed state
      open: {
        default: true,
        parseHTML: element => element.getAttribute('data-open') === 'true',
        renderHTML: attributes => {
          return {
            'data-open': attributes.open.toString(),
          }
        },
      }
    }
  },
  
  // Allow any block content inside the toggle
  content: 'block*',
  
  defining: true,
  
  // Make it draggable like other blocks
  draggable: true,
  
  // Allow selection
  selectable: true,
  
  addOptions() {
    return {
      HTMLAttributes: {
        class: 'toggle-block',
      },
    }
  },
  
  parseHTML() {
    return [
      {
        tag: 'div[data-type="toggle-block"]',
      },
    ]
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': 'toggle-block' }), 0]
  },
  
  addNodeView() {
    return ReactNodeViewRenderer(ToggleBlockView)
  },
  
  addCommands() {
    return {
      setToggleBlock: (title = 'Toggle') => ({ commands, chain, state }) => {
        // Get the current node
        const { $from, $to } = state.selection
        const range = $from.blockRange($to)
        
        if (!range) return false
        
        // Get the content of the current block to use as title if available
        const currentNodeText = $from.parent.textContent
        const toggleTitle = currentNodeText || title
        
        // Delete the current block
        const success = chain()
          .deleteRange({ from: range.start, to: range.end })
          // Insert a toggle block with the title as an attribute
          .insertContent({
            type: 'toggleBlock',
            attrs: { title: toggleTitle, open: true },
            content: [
              { type: 'paragraph' },
              { type: 'paragraph' },
              { type: 'paragraph' }
            ]
          })
          .run()
        
        // Focus inside the toggle
        if (success) {
          setTimeout(() => {
            const pos = state.selection.$from.pos + 1
            chain().setTextSelection(pos).focus().run()
          }, 10)
        }
        
        return success
      },
      
      toggleToggleBlock: () => ({ commands, state }) => {
        const { $from, $to } = state.selection
        const range = $from.blockRange($to)
        
        if (!range) return false
        
        const isInToggleBlock = this.isActive(state)
        
        if (isInToggleBlock) {
          // Lift the content out of the toggle block
          return commands.lift(this.name)
        }
        
        // Convert to toggle block
        return commands.setToggleBlock()
      },
    }
  },
  
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-t': () => this.editor.commands.toggleToggleBlock(),
    }
  },
})

export default ToggleBlock 