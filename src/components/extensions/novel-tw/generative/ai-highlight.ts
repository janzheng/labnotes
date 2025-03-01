import { type Editor, Mark, markInputRule, markPasteRule, mergeAttributes } from "@tiptap/core";

export interface AIHighlightOptions {
  HTMLAttributes: Record<string, string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    AIHighlight: {
      /**
       * Set a AIHighlight mark
       */
      setAIHighlight: (attributes?: { color: string }) => ReturnType;
      /**
       * Toggle a AIHighlight mark
       */
      toggleAIHighlight: (attributes?: { color: string }) => ReturnType;
      /**
       * Unset a AIHighlight mark
       */
      unsetAIHighlight: () => ReturnType;
    };
  }
}

export const inputRegex = /(?:^|\s)((?:==)((?:[^~=]+))(?:==))$/;
export const pasteRegex = /(?:^|\s)((?:==)((?:[^~=]+))(?:==))/g;

export const AIHighlight = Mark.create<AIHighlightOptions>({
  name: "ai-highlight",

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'ai-highlight',
      },
    };
  },

  addAttributes() {
    return {
      color: {
        default: "#c1ecf970", // Make this a more noticeable default
        parseHTML: (element) => element.getAttribute("data-color") || element.style.backgroundColor,
        renderHTML: (attributes) => {
          if (!attributes.color) {
            return {};
          }

          return {
            "data-color": attributes.color,
            "class": "ai-highlight",
            style: `background-color: ${attributes.color}; color: inherit; padding-top: 5px; padding-bottom: 5px; border-radius: 2px;`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "mark",
        getAttrs: (node) => {
          if (typeof node === 'string') return null;
          const element = node as HTMLElement;
          return element.classList.contains('ai-highlight') ? {} : false;
        },
      },
      {
        tag: "span.ai-highlight",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["mark", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setAIHighlight:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      toggleAIHighlight:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, attributes);
        },
      unsetAIHighlight:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-h": () => this.editor.commands.toggleAIHighlight(),
    };
  },

  addInputRules() {
    return [
      markInputRule({
        find: inputRegex,
        type: this.type,
      }),
    ];
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: pasteRegex,
        type: this.type,
      }),
    ];
  },
});

export const removeAIHighlight = (editor: Editor) => {
  if (!editor) return;

  try {
    const tr = editor.state.tr;
    tr.removeMark(0, editor.state.doc.nodeSize - 2, editor.state.schema.marks["ai-highlight"]);
    editor.view.dispatch(tr);
  } catch (error) {
    console.error('[REMOVE-AI-HIGHLIGHT] Error removing highlight:', error);
  }
};

export const addAIHighlight = (editor: Editor, color?: string) => {
  if (!editor) return;
  
  const highlightColor = color ?? "#B5D8FE";
  
  // Get the current selection
  const { from, to } = editor.state.selection;
  
  
  try {
    editor
      .chain()
      .focus()
      .setAIHighlight({ color: highlightColor })
      .run();
    
  } catch (error) {
    console.error('[ADD-AI-HIGHLIGHT] Error applying highlight with chain command:', error);
  }

  // Check if the mark was applied successfully
  setTimeout(() => {
    const marks = editor.state.doc.nodeAt(from)?.marks;
    const hasAIHighlight = marks?.some(mark => mark.type.name === 'ai-highlight');
  }, 50);
};
