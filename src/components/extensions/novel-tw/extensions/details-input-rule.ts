import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'

export const DetailsInputRule = Extension.create({
  name: 'detailsInputRule',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('detailsInputRule'),
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

              // If we're at position 1 (right after '>'), convert to details
              if ($from.parentOffset === 1 && $from.parent.textContent[0] === '>') {
                // Delete the '>' character
                const tr = state.tr.delete($from.pos - 1, $from.pos)
                dispatch(tr)

                // Convert to details block
                this.editor.commands.setDetailsBlock('Details Yay')
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

export default DetailsInputRule