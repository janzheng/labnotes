import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const TaskBackspace = Extension.create({
  name: 'taskBackspace',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('taskBackspace'),
        props: {
          handleKeyDown: (view, event) => {
            const { state, dispatch } = view;
            
            // Only handle backspace key
            if (event.key !== 'Backspace') {
              return false;
            }
            
            const { selection } = state;
            const { $from, empty } = selection;
            
            // Only handle when cursor is at the beginning of a task item
            if (!empty || $from.parent.type.name !== 'taskItem') {
              return false;
            }
            
            // Check if the task item is empty or only contains an empty paragraph
            const isEmpty = $from.parent.content.size === 0 || 
                           ($from.parent.childCount === 1 && 
                            $from.parent.firstChild?.type.name === 'paragraph' && 
                            $from.parent.firstChild.content.size === 0);
            
            if (!isEmpty) {
              return false;
            }
            
            // Find the position of the task item
            const taskItemPos = $from.before($from.depth);
            
            // Create a transaction to lift the content out of the list
            const tr = state.tr;
            
            // Delete the task item
            tr.delete(taskItemPos, taskItemPos + $from.parent.nodeSize);
            
            // Insert a paragraph at the same position
            const paragraph = state.schema.nodes.paragraph.create();
            tr.insert(taskItemPos, paragraph);
            
            // Set selection to the start of the new paragraph
            const resolvedPos = tr.doc.resolve(taskItemPos + 1);
            tr.setSelection(state.selection.constructor.near(resolvedPos));
            
            dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
}); 