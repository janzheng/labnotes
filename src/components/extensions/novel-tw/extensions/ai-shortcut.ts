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

        // Prevent multiple triggers by checking if an AI selector is already open
        const existingEvent = window.localStorage.getItem('novel:ai-selector-open');
        const now = Date.now();
        
        if (existingEvent) {
          const lastOpened = parseInt(existingEvent, 10);
          // If an AI selector was opened in the last 300ms, don't open another one
          if (now - lastOpened < 300) {
            console.log("Preventing duplicate AI selector");
            return true;
          }
        }
        
        // Mark that we're opening an AI selector
        window.localStorage.setItem('novel:ai-selector-open', now.toString());
        
        // Trigger the AI selector - works regardless of selection state
        setTimeout(() => {
          const event = new CustomEvent('novel:open-ai-selector', {
            detail: {
              open: true,
              timestamp: now,
              source: 'keyboard',
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
          
          // Prevent multiple triggers by checking if an AI selector is already open
          const existingEvent = window.localStorage.getItem('novel:ai-selector-open');
          const now = Date.now();
          
          if (existingEvent) {
            const lastOpened = parseInt(existingEvent, 10);
            // If an AI selector was opened in the last 300ms, don't open another one
            if (now - lastOpened < 300) {
              console.log("Preventing duplicate AI selector");
              return true;
            }
          }
          
          // Mark that we're opening an AI selector
          window.localStorage.setItem('novel:ai-selector-open', now.toString());

          // Trigger the AI selector
          setTimeout(() => {
            const event = new CustomEvent('novel:open-ai-selector', {
              detail: {
                open: true,
                timestamp: now,
                source: 'space',
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