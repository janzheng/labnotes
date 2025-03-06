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
      setToggleBlock: (title?: string, fromShortcut?: boolean) => ReturnType
      /**
       * Convert current block to toggle block
       */
      toggleToggleBlock: () => ReturnType
      /**
       * Toggle the open/closed state of a toggle block
       */
      toggleOpenState: () => ReturnType
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
            'data-title': attributes.title || 'Toggle',
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
      },
      // Add a unique ID for connecting header and content
      toggleId: {
        default: () => `toggle-${Math.random().toString(36).substring(2, 11)}`,
        parseHTML: element => element.getAttribute('data-toggle-id'),
        renderHTML: attributes => {
          return {
            'data-toggle-id': attributes.toggleId,
          }
        },
      }
    }
  },
  
  // Allow any block content inside the toggle
  content: 'block+',  // Require at least one block for the summary
  
  defining: true,
  
  // Make it draggable like other blocks
  draggable: true,
  
  // Allow selection
  selectable: true,
  
  // Add more global selection handling
  addGlobalAttributes() {
    return [
      {
        types: ['toggleBlock'],
        attributes: {
          selectedText: {
            default: '',
            parseHTML: () => '',
            renderHTML: () => ({}),
          },
        },
      },
    ]
  },
  
  addOptions() {
    return {
      HTMLAttributes: {
        class: 'toggle-block node-toggleBlock',
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
    return [
      'div', 
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 
        'data-type': 'toggle-block',
        'class': 'toggle-block node-toggleBlock'
      }), 
      0
    ]
  },
  
  addNodeView() {
    return ReactNodeViewRenderer(ToggleBlockView)
  },
  
  addCommands() {
    return {
      setToggleBlock: (title = 'Toggle', fromShortcut = false) => ({ commands, chain, state }) => {
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
          // Insert a toggle block with the title in the first paragraph
          .insertContent({
            type: 'toggleBlock',
            attrs: { title: toggleTitle, open: true },
            content: [
              { 
                type: 'paragraph', 
                attrs: { class: 'toggle-title-first-paragraph' },
                content: [{ type: 'text', text: toggleTitle }] 
              },
              { type: 'paragraph' }
            ]
          })
          .run()
        
        // Improved focus behavior
        if (success) {
          setTimeout(() => {
            // Set node selection on the toggle block itself
            const pos = state.selection.$from.before($from.depth);
            chain().setNodeSelection(pos).run()
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
      
      // New command to toggle open/closed state
      toggleOpenState: () => ({ tr, state, dispatch }) => {
        const { $from } = state.selection
        let node = $from.node($from.depth)
        let pos = $from.before($from.depth)
        
        // If not directly in a toggle block, try to find one as a parent
        if (node.type.name !== 'toggleBlock') {
          for (let d = $from.depth; d > 0; d--) {
            node = $from.node(d)
            if (node.type.name === 'toggleBlock') {
              pos = $from.before(d)
              break
            }
          }
        }
        
        if (node.type.name !== 'toggleBlock') {
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
      'Mod-Shift-t': () => this.editor.commands.toggleToggleBlock(),
      // Add Space to toggle between open/closed when toggle is selected
      'Space': () => {
        const { state } = this.editor
        const { selection } = state
        
        // Check if the selection is on a toggle block
        if (selection.$from.parent.type.name === 'toggleBlock') {
          return this.editor.commands.toggleOpenState()
        }
        
        return false
      }
    }
  },
})

export default ToggleBlock 