import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { TextSelection } from 'prosemirror-state'

export const QuoteInputRule = Extension.create({
  name: 'quoteInputRule',
  
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('quoteInputRule'),
        props: {
          handleKeyDown: (view, event) => {
            // Check if '|' was typed at the beginning of a line
            if (event.key === '|' && view.state.selection.$from.parentOffset === 0) {
              // Store that we're waiting for a space
              this.storage.waitingForSpace = true
              return false
            }
            
            // Check if space was pressed after '|'
            if (event.key === ' ' && this.storage.waitingForSpace) {
              const { state, dispatch } = view
              const { $from } = state.selection
              
              // Reset the flag
              this.storage.waitingForSpace = false
              
              // If we're at position 1 (right after '|'), convert to blockquote
              if ($from.parentOffset === 1 && $from.parent.textContent[0] === '|') {
                // Delete the '|' character
                const tr = state.tr.delete($from.pos - 1, $from.pos)
                dispatch(tr)
                
                // Convert to blockquote
                this.editor.commands.setBlockquote()
                return true
              }
            }
            
            return false
          }
        }
      })
    ]
  },
  
  addStorage() {
    return {
      waitingForSpace: false
    }
  }
})

export default QuoteInputRule 