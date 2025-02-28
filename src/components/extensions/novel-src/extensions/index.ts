import { InputRule } from "@tiptap/core";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import TiptapImage from "@tiptap/extension-image";
import TiptapLink from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import TextStyle from "@tiptap/extension-text-style";
import TiptapUnderline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import CustomKeymap from "./custom-keymap";
import { ImageResizer } from "./image-resizer";
import { Twitter } from "./twitter";
import { Mathematics } from "./mathematics";
import UpdatedImage from "./updated-image";
import CustomDragHandle from "./custom-drag-handle";
import CustomAddHandle from "./custom-add-handle";
import { Extension } from "@tiptap/core";

import CharacterCount from "@tiptap/extension-character-count";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Youtube from "@tiptap/extension-youtube";
// import GlobalDragHandle from "tiptap-extension-global-drag-handle";

const PlaceholderExtension = Placeholder.configure({
  placeholder: ({ node, pos, editor }) => {
    if (node.type.name === "heading") {
      return `Heading ${node.attrs.level}`;
    }
    return "Press 'space' for AI, or '/' for commands.";
  },
  includeChildren: true,
});

const HighlightExtension = Highlight.configure({
  multicolor: true,
});

const MarkdownExtension = Markdown.configure({
  html: false,
  transformCopiedText: true,
});

const Horizontal = HorizontalRule.extend({
  addInputRules() {
    return [
      new InputRule({
        find: /^(?:---|—-|___\s|\*\*\*\s)$/u,
        handler: ({ state, range }) => {
          const attributes = {};

          const { tr } = state;
          const start = range.from;
          const end = range.to;

          tr.insert(start - 1, this.type.create(attributes)).delete(tr.mapping.map(start), tr.mapping.map(end));
        },
      }),
    ];
  },
});

// Completely revised SpaceAITrigger extension using keymap instead of InputRule
// const SpaceAITrigger = Extension.create({
//   name: 'spaceAITrigger',
  
//   addKeyboardShortcuts() {
//     return {
//       'Space': ({ editor }) => {
//         // Check if we're at the beginning of a block
//         const { selection, doc } = editor.state;
//         const { from } = selection;
        
//         // Get the position information
//         const resolvedPos = doc.resolve(from);
//         const isAtBlockStart = resolvedPos.parentOffset === 0;
        
//         // If at the beginning of a block, trigger AI selector
//         if (isAtBlockStart) {
//           console.log("Space pressed at beginning of block, triggering AI selector");
          
//           // Trigger the AI selector
//           setTimeout(() => {
//             const event = new CustomEvent('novel:open-ai-selector', { 
//               detail: { 
//                 open: true, 
//                 timestamp: Date.now(), 
//                 source: 'space',
//                 position: from
//               } 
//             });
//             window.dispatchEvent(event);
//           }, 10);
          
//           // Return true to prevent the default space behavior
//           return true;
//         }
        
//         // Not at beginning of block, let default space behavior happen
//         return false;
//       }
//     };
//   }
// });

export * from "./ai-highlight";
export * from "./slash-command";
export {
  CodeBlockLowlight,
  Horizontal as HorizontalRule,
  ImageResizer,
  InputRule,
  PlaceholderExtension as Placeholder,
  StarterKit,
  TaskItem,
  TaskList,
  TiptapImage,
  TiptapUnderline,
  MarkdownExtension,
  TextStyle,
  Color,
  HighlightExtension,
  CustomKeymap,
  TiptapLink,
  UpdatedImage,
  Youtube,
  Twitter,
  Mathematics,
  CharacterCount,
  // GlobalDragHandle,
  CustomDragHandle,
  CustomAddHandle,
  SpaceAITrigger,
};
