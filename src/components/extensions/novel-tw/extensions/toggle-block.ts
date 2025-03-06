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
       * Create a toggle block
       */
      setToggleBlock: () => ReturnType
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
  
  // Allow any block content inside the toggle
  content: 'block+',
  
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
      setToggleBlock: () => ({ commands, state }) => {
        // Get the current node
        const { $from, $to } = state.selection
        const range = $from.blockRange($to)
        
        if (!range) return false
        
        // Create a toggle block with the current block as summary
        return commands.wrapIn(this.name)
      },
      
      toggleToggleBlock: () => ({ commands, state }) => {
        const { $from, $to } = state.selection
        const range = $from.blockRange($to)
        
        if (!range) return false
        
        const isInToggleBlock = this.isActive(state)
        
        if (isInToggleBlock) {
          return commands.lift(this.name)
        }
        
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