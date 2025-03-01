import { Extension } from '@tiptap/core';

// Extension that triggers AI when Cmd/Ctrl+K is pressed
export const AIShortcut = Extension.create({
  name: 'aiShortcut',

  addKeyboardShortcuts() {
    return {
      'Mod-k': ({ editor }) => {
        // Get the current selection and document
        const { selection } = editor.state;
        const { from } = selection;

        // To prevent duplicate events, use a debounce technique
        const now = Date.now();
        const lastTriggerTime = parseInt(window.sessionStorage.getItem('novel:last-mod-k-trigger') || '0', 10);
        
        // Prevent duplicate triggers within 500ms
        if (now - lastTriggerTime < 500) {
          console.log("Preventing duplicate Mod-k trigger");
          return true;
        }
        
        // Store this trigger time
        window.sessionStorage.setItem('novel:last-mod-k-trigger', now.toString());
        
        // Trigger the AI selector - works regardless of selection state
        setTimeout(() => {
          const event = new CustomEvent('novel:open-ai-selector', {
            detail: {
              open: true,
              source: 'mod-k', // Use the same source identifier expected in the trigger manager
              position: from,
              hasSelection: selection.from !== selection.to
            }
          });
          window.dispatchEvent(event);
        }, 10);

        // Return true to prevent the default behavior
        return true;
      }
    };
  }
});


export const SpaceAITrigger = Extension.create({
  name: 'spaceAITrigger',

  addKeyboardShortcuts() {
    return {
      'Space': ({ editor }) => {
        // Check if we're at the beginning of a block
        const { selection, doc } = editor.state;
        const { from } = selection;

        // Get the position information
        const resolvedPos = doc.resolve(from);
        const isAtBlockStart = resolvedPos.parentOffset === 0;

        // If at the beginning of a block, trigger AI selector
        if (isAtBlockStart) {
          console.log("Space pressed at beginning of block, triggering AI selector");
          
          // To prevent duplicate events, use a debounce technique
          const now = Date.now();
          const lastTriggerTime = parseInt(window.sessionStorage.getItem('novel:last-space-trigger') || '0', 10);
          
          // Prevent duplicate triggers within 500ms
          if (now - lastTriggerTime < 500) {
            console.log("Preventing duplicate space trigger");
            return true;
          }
          
          // Store this trigger time
          window.sessionStorage.setItem('novel:last-space-trigger', now.toString());

          // Trigger the AI selector
          setTimeout(() => {
            const event = new CustomEvent('novel:open-ai-selector', {
              detail: {
                open: true,
                source: 'space-command', // Use the same source identifier expected in the trigger manager
                position: from,
                hasSelection: false // Space trigger never has a selection
              }
            });
            window.dispatchEvent(event);
          }, 10);

          // Return true to prevent the default space behavior
          return true;
        }

        // Not at beginning of block, let default space behavior happen
        return false;
      }
    };
  }
});


export default AIShortcut; 