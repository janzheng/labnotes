import { Extension } from '@tiptap/core';

// Extension that clears formatting when backspace is pressed at the beginning of a line
const ClearFormatBackspace = Extension.create({
  name: 'clearFormatBackspace',

  addKeyboardShortcuts() {
    return {
      'Backspace': ({ editor }) => {
        // Get current selection
        const { selection, doc } = editor.state;
        const { from, empty } = selection;
        
        // Only proceed if we have a cursor (not a selection)
        if (!empty) {
          return false;
        }
        
        // Check if cursor is at the beginning of a text block
        const resolvedPos = doc.resolve(from);
        const isAtStart = resolvedPos.parentOffset === 0;
        
        // Only proceed if we're at the start of a block that's not the first block
        if (isAtStart && resolvedPos.pos > 1) {
          // Get the current node
          const node = resolvedPos.parent;
          
          // If the node has marks or is not a paragraph, clear formatting
          if ((node.type.name !== 'paragraph' || node.marks.length > 0) && node.textContent.length > 0) {
            // Store the current position to restore cursor later
            const currentPos = resolvedPos.pos;
            
            try {
              // Calculate valid positions
              const nodeStart = resolvedPos.start();
              const nodeEnd = resolvedPos.end();
              
              // Validate positions to avoid NaN errors
              if (isNaN(nodeStart) || isNaN(nodeEnd) || nodeStart < 0 || nodeEnd > doc.content.size) {
                return false;
              }
              
              // First, remove all marks from the current node without changing structure
              editor.chain()
                .setTextSelection({ from: nodeStart, to: nodeEnd })
                .unsetAllMarks()
                .setTextSelection(currentPos)
                .run();
              
              // If the node is not a paragraph, convert it to a paragraph
              if (node.type.name !== 'paragraph') {
                editor.chain()
                  .setTextSelection({ from: nodeStart, to: nodeEnd })
                  .setParagraph()
                  .setTextSelection(currentPos)
                  .run();
              }
            } catch (error) {
              console.error('Error in ClearFormatBackspace extension:', error);
              return false;
            }
            
            // Return true to prevent the default backspace behavior
            // This ensures we only clear formatting on first backspace
            return true;
          }
        }
        
        // Default behavior for other cases
        return false;
      }
    };
  }
});

export default ClearFormatBackspace; 