import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { TextSelection } from 'prosemirror-state'

export const ToggleInputRule = Extension.create({
  name: 'toggleInputRule',
  
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('toggleInputRule'),
        props: {
          handleKeyDown: (view, event) => {
            // Check if '>' was typed at the beginning of a line
            if (event.key === '>' && view.state.selection.$from.parentOffset === 0) {
              // Store that we're waiting for a space
              this.storage.waitingForSpace = true
              return false
            }
            
            // Check if space was pressed after '>'
            if (event.key === ' ' && this.storage.waitingForSpace) {
              const { state, dispatch } = view
              const { $from } = state.selection
              
              // Reset the flag
              this.storage.waitingForSpace = false
              
              // If we're at position 1 (right after '>'), convert to toggle
              if ($from.parentOffset === 1 && $from.parent.textContent[0] === '>') {
                // Delete the '>' character
                const tr = state.tr.delete($from.pos - 1, $from.pos)
                
                // Create a paragraph for the toggle content
                const paragraph = state.schema.nodes.paragraph.create()
                
                // Insert the paragraph after deleting '>'
                tr.insert($from.pos - 1, paragraph)
                
                // Set selection to the new paragraph
                const newPos = $from.pos - 1 + 1 // +1 for the paragraph node start
                tr.setSelection(TextSelection.create(tr.doc, newPos))
                
                dispatch(tr)
                
                // Convert to toggle block
                setTimeout(() => {
                  this.editor.commands.setToggleBlock()
                }, 0)
                
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

export default ToggleInputRule 