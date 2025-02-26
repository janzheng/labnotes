// Components
export {
  EditorRoot,
  EditorContent,
  type EditorContentProps,
  EditorBubble,
  EditorBubbleItem,
  EditorCommand,
  EditorCommandList,
  EditorCommandItem,
  EditorCommandEmpty,
  useEditor,
  type EditorInstance,
  type JSONContent,
} from "./components";

// Extensions
export {
  // ContentItemMenu,
  AIHighlight,
  removeAIHighlight,
  addAIHighlight,
  CodeBlockLowlight,
  HorizontalRule,
  ImageResizer,
  InputRule,
  Placeholder,
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
  GlobalDragHandle,
  Command,
  renderItems,
  createSuggestionItems,
  handleCommandNavigation,
  type SuggestionItem,
} from "./extensions";

// Export our custom EnhancedDragHandle
export { default as EnhancedDragHandle } from "../novel-tw/extensions/enhanced-drag-handle";

// Plugins
export {
  UploadImagesPlugin,
  type UploadFn,
  type ImageUploadOptions,
  createImageUpload,
  handleImageDrop,
  handleImagePaste,
} from "./plugins";

// Utils
export {
  isValidUrl,
  getUrlFromString,
  getPrevText,
  getAllContent,
} from "./utils";

// Store and Atoms
export { queryAtom, rangeAtom } from "./utils/atoms";
