"use client";
import { defaultEditorContent } from "@/lib/novel-content";
import {
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
  EditorCommandList,
  EditorContent,
  type EditorInstance,
  EditorRoot,
  ImageResizer,
  type JSONContent,
  handleCommandNavigation,
  handleImageDrop,
  handleImagePaste,
} from "@/components/extensions/novel-src";
import { useEffect, useState, useCallback, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { defaultExtensions } from "./extensions";
import { ColorSelector } from "./selectors/color-selector";
import { LinkSelector } from "./selectors/link-selector";
import { MathSelector } from "./selectors/math-selector";
import { NodeSelector } from "./selectors/node-selector";
import { Separator } from "./ui/separator";

import { Footnotes, FootnoteReference, Footnote } from "tiptap-footnotes";

import Emoji, { gitHubEmojis } from '@/components/tiptap/extension-emoji'
import Document from "@tiptap/extension-document";
import GlobalDragHandle from "@/components/extensions/novel-src/extensions/custom-drag-handle";
import AddLineHandle from "@/components/extensions/novel-src/extensions/custom-add-handle";

import GenerativeMenuSwitch from "./generative/generative-menu-switch";
import { uploadFn } from "./image-upload";
import { TextButtons } from "./selectors/text-buttons";
import { slashCommand, suggestionItems } from "./slash-command";

import hljs from "highlight.js";
import { DragStateManager } from "@/components/extensions/novel-src/extensions/drag-state-manager";
import ClearFormatBackspace from "./extensions/clear-format-backspace";
import { AIShortcut, SpaceAITrigger } from "./extensions/ai-shortcut";


// Debug logger
function logDebug(...args) {
  if (window.___novelAdvEditorDebug) {
    console.log('[ADVANCED-EDITOR-DEBUG]', ...args);
  }
}

// Customize the Document extension to support footnotes
const CustomDocument = Document.extend({
  content: "block+ footnotes?",
});

// Configure the GlobalDragHandle extension with custom handlers
const customDragHandle = GlobalDragHandle.configure({
  dragHandleWidth: 20,
  scrollTreshold: 100,
  excludedTags: ['FIGURE'],
  // Add custom event handlers for the drag handle commands
  onCopyToClipboard: (editor, pos) => {
    if (!editor || pos === null) {
      return;
    }
    
    try {
      const { state } = editor;
      editor.commands.setNodeSelection(pos);
      
      setTimeout(() => {
        document.execCommand('copy');
        
        editor.commands.focus();
      }, 0);
      
    } catch (error) {
    }
  },
  
  onDuplicate: (editor, pos) => {
    if (!editor || pos === null) {
      return;
    }
    
    try {
      editor.commands.setNodeSelection(pos);
      
      const node = editor.state.doc.nodeAt(pos);
      if (!node) {
        return;
      }
      
      const tr = editor.state.tr;
      tr.insert(pos + node.nodeSize, node);
      editor.view.dispatch(tr);
      
    } catch (error) {
    }
  },
  
  onDelete: (editor, pos) => {
    if (!editor || pos === null) {
      return;
    }
    
    try {
      editor.commands.setNodeSelection(pos);
      
      editor.commands.deleteSelection();
      
      editor.commands.focus();
      
    } catch (error) {
    }
  }
});

// Modify the extensions array to include our drag state manager and new extension
const extensions = [
  ...defaultExtensions.filter(extension => extension.name !== 'document' && extension.name !== 'globalDragHandle'),
  CustomDocument,
  DragStateManager,
  customDragHandle,
  AddLineHandle.configure({
    handleWidth: 20,
    scrollTreshold: 100,
    excludedTags: ['FIGURE'],
  }),
  slashCommand,
  Emoji.configure({
    emojis: gitHubEmojis,
    enableEmoticons: true,
  }),
  ClearFormatBackspace,
  AIShortcut,
  SpaceAITrigger,
  Footnotes, 
  FootnoteReference, 
  Footnote
];

// Update the props interface
interface TailwindAdvancedEditorProps {
  defaultValue?: string | undefined;
  onChange?: (content: string, wordCount?: number) => void;
  editorRef?: React.MutableRefObject<EditorInstance | null>;
  onWordCountChange?: (count: number) => void;
  onSaveStatusChange?: (status: string) => void;
}

// Update the component definition
const TailwindAdvancedEditor: React.FC<TailwindAdvancedEditorProps> = ({
  defaultValue,
  onChange,
  editorRef,
  onWordCountChange,
  onSaveStatusChange
}) => {
  const [openNode, setOpenNode] = useState(false);
  const [openLink, setOpenLink] = useState(false);
  const [openColor, setOpenColor] = useState(false);
  const [openAI, setOpenAI] = useState(false);
  
  // Add these state variables for AI completion
  const [completion, setCompletion] = useState("");
  const [action, setAction] = useState<string | null>(null);

  const [editor, setEditor] = useState<EditorInstance | null>(null);
  const isUpdatingExternally = useRef(false);

  // Function to update word count from editor state
  const updateWordCount = useCallback((editorInstance: EditorInstance) => {
    try {
      if (editorInstance.storage.characterCount) {
        const wordCount = editorInstance.storage.characterCount.words() || 0;
        // Instead of updating local state, call the parent's callback
        if (onWordCountChange) {
          onWordCountChange(wordCount);
        }
      }
    } catch (error) {
      logDebug('Error updating word count:', error);
    }
  }, [onWordCountChange]);

  // Clean implementation of onEditorReady
  const onEditorReady = useCallback((editorInstance: EditorInstance) => {
    setEditor(editorInstance);
    
    // Debug keyboard shortcuts
    console.log('Editor ready, registered keyboard shortcuts:', 
      editorInstance.extensionManager.keyboardShortcuts);

    // Directly set the ref when the editor is ready
    if (editorRef) {
      editorRef.current = editorInstance;
      
      // Add forceUpdate method immediately
      (editorInstance as any).forceUpdate = (content: JSONContent) => {
        // Set flag to prevent onChange from firing during external update
        isUpdatingExternally.current = true;
        
        try {
          // Replace with new content
          editorInstance.commands.setContent(content, false);
          
          // Update word count
          updateWordCount(editorInstance);
          
          // Force re-render for complete update
          setTimeout(() => {
            editorInstance.commands.focus('end');
            isUpdatingExternally.current = false;
          }, 0);
        } catch (error) {
          console.error('Error in forceUpdate:', error);
          isUpdatingExternally.current = false;
        }
      };
    }
    
    // Calculate initial word count
    updateWordCount(editorInstance);
  }, [editorRef, updateWordCount]);

  // Parse defaultValue if it's a string
  const parsedDefaultValue = typeof defaultValue === 'string' && defaultValue 
    ? JSON.parse(defaultValue) 
    : defaultValue;
    
  const [initialContent] = useState<JSONContent>(
    parsedDefaultValue || defaultEditorContent
  );
  
  // Register the editor with the global drag handle commands
  useEffect(() => {
    if (editor) {
      // Make the editor instance globally available for the drag handle
      window.novelEditor = editor;
      
      // Calculate word count when editor is first available
      // This ensures word count is available on first load
      updateWordCount(editor);
    }
    
    return () => {
      // Clean up when component unmounts
      delete window.novelEditor;
    };
  }, [editor, updateWordCount]);
  
  // Event listener setup for AI selector and drag handle
  useEffect(() => {
    // Listen for the custom event to open the AI selector
    const handleOpenAISelector = (event: CustomEvent) => {
      if (event.detail?.open) {
        // Check if we need to select text first
        if (event.detail?.selectText && editor) {
          try {
            // If we have a position from the event, use it
            const startPos = event.detail.position !== undefined 
              ? event.detail.position 
              : editor.state.selection.from;
            
            // Ensure we're at a valid position in the document
            if (startPos < editor.state.doc.content.size) {
              // First make sure the cursor is at the right position
              editor.commands.setNodeSelection(startPos);
              
              // Force the bubble to show by creating a minimal selection
              setTimeout(() => {
                // Find the nearest text node and select one character
                const resolvedPos = editor.state.doc.resolve(startPos);
                const node = resolvedPos.node();
                
                // Force selection of the node to trigger bubble
                editor.chain()
                  .focus()
                  .selectNodeForward()
                  .run();
                
                // Force the force editorview to update
                editor.commands.focus();
                
                setOpenAI(true);
              }, 10);
            } else {
              setOpenAI(true);
            }
          } catch (e) {
            console.error('Error during text selection:', e);
            setOpenAI(true);
          }
        } else {
          setOpenAI(true);
        }
      }
    };
    
    // Listen for the add block event
    const handleAddBlock = (event: CustomEvent) => {
      if (event.detail?.position !== undefined) {
        // Get the editor instance
        const editor = document.querySelector('.ProseMirror')?.['editor'];
        if (editor) {
          // Set the cursor position
          editor.commands.setNodeSelection(event.detail.position);
          
          // Open the slash command menu
          const slashEvent = new KeyboardEvent('keydown', {
            key: '/',
            code: 'Slash',
            keyCode: 191,
            which: 191,
            bubbles: true
          });
          document.activeElement?.dispatchEvent(slashEvent);
        }
      }
    };
    
    // Listen for drag handle command events
    const handleDragHandleCommand = (event: CustomEvent) => {
      if (!editor) {
        return;
      }
      
      const { command, position } = event.detail || {};
      if (!command || position === undefined) {
        return;
      }
      
      switch (command) {
        case 'copy':
          if (typeof customDragHandle.options.onCopyToClipboard === 'function') {
            customDragHandle.options.onCopyToClipboard(editor, position);
          }
          break;
        case 'duplicate':
          if (typeof customDragHandle.options.onDuplicate === 'function') {
            customDragHandle.options.onDuplicate(editor, position);
          }
          break;
        case 'delete':
          if (typeof customDragHandle.options.onDelete === 'function') {
            customDragHandle.options.onDelete(editor, position);
          }
          break;
      }
    };
    
    window.addEventListener('novel:open-ai-selector', handleOpenAISelector as EventListener);
    window.addEventListener('novel:add-block', handleAddBlock as EventListener);
    window.addEventListener('novel:drag-handle-command', handleDragHandleCommand as EventListener);
    
    return () => {
      window.removeEventListener('novel:open-ai-selector', handleOpenAISelector as EventListener);
      window.removeEventListener('novel:add-block', handleAddBlock as EventListener);
      window.removeEventListener('novel:drag-handle-command', handleDragHandleCommand as EventListener);
    };
  }, [editor, openAI]);

  const debouncedUpdates = useDebouncedCallback(async (editor: EditorInstance) => {
    // Skip updates that are triggered by external content changes
    if (isUpdatingExternally.current) {
      return;
    }
    
    // Update word count
    updateWordCount(editor);
    
    // Update save status via parent callback
    if (onSaveStatusChange) {
      onSaveStatusChange("Saved");
    }
    
    // Call the onChange handler with the editor content and word count
    if (onChange) {
      const jsonContent = editor.getJSON();
      const wordCount = editor.storage.characterCount?.words() || 0;
      onChange(JSON.stringify(jsonContent), wordCount);
    }
  }, 500);
  

  // Handle streaming updates for selection transformations
  useEffect(() => {
    if (action === "transform_selection" && completion && editor) {
      try {
        // Store the original selection positions
        const { from, to } = editor.state.selection;
        
        // Check if we still have a valid selection
        if (from !== to) {
          // Replace the selected text with the current completion
          editor.chain()
            .focus()
            .deleteRange({ from, to })
            .insertContent(completion)
            .run();
            
          // Set cursor at the end of inserted content
          const newPos = from + completion.length;
          editor.chain().setTextSelection(newPos).run();
        } else {
          // If selection is lost, try to insert at current cursor position
          editor.chain()
            .focus()
            .insertContent(completion)
            .run();
        }
        
        console.log("Updated editor with streaming completion:", completion);
      } catch (error) {
        console.error("Error updating editor with completion:", error);
      }
    }
  }, [completion, action, editor]);
  
  return (
    <div className="relative">
      <EditorRoot>
        <EditorContent
          initialContent={initialContent}
          extensions={extensions}
          className="relative min-h-[500px] w-full max-w-screen-lg border-muted bg-background"
          editorProps={{
            handleDOMEvents: {
              keydown: (_view, event) => handleCommandNavigation(event),
            },
            handlePaste: (view, event) => handleImagePaste(view, event, uploadFn),
            handleDrop: (view, event, _slice, moved) => handleImageDrop(view, event, moved, uploadFn),
            attributes: {
              class:
                "prose dark:prose-invert prose-headings:font-title font-default focus:outline-none max-w-full",
            },
          }}
          onReady={onEditorReady}
          onUpdate={({ editor }) => {
            // Skip updates that are triggered by external content changes
            if (isUpdatingExternally.current) {
              return;
            }
            debouncedUpdates(editor);
            
            // Update save status via parent callback
            if (onSaveStatusChange) {
              onSaveStatusChange("Unsaved");
            }
          }}
          slotAfter={
            <ImageResizer />
          }
        >
          <EditorCommand className="z-50 h-auto max-h-[330px] overflow-y-auto rounded-md border border-muted bg-background px-1 py-2 shadow-md transition-all">
            <EditorCommandEmpty className="px-2 text-muted-foreground">No results</EditorCommandEmpty>
            <EditorCommandList>
              {suggestionItems.map((item) => (
                <EditorCommandItem
                  value={item.title}
                  onCommand={(val) => item.command(val)}
                  className="flex w-full items-center space-x-2 rounded-md px-2 py-1 text-left text-sm hover:bg-accent aria-selected:bg-accent"
                  key={item.title}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-muted bg-background">
                    {item.icon}
                  </div>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </EditorCommandItem>
              ))}
            </EditorCommandList>
          </EditorCommand>

          <GenerativeMenuSwitch open={openAI} onOpenChange={setOpenAI}>
            <Separator orientation="vertical" />
            <NodeSelector open={openNode} onOpenChange={setOpenNode} />
            <Separator orientation="vertical" />

            <LinkSelector open={openLink} onOpenChange={setOpenLink} />
            <Separator orientation="vertical" />
            <MathSelector />
            <Separator orientation="vertical" />
            <TextButtons />
            <Separator orientation="vertical" />
            <ColorSelector open={openColor} onOpenChange={setOpenColor} />
          </GenerativeMenuSwitch>
        </EditorContent>
      </EditorRoot>
    </div>
  );
};

// Add this declaration for debugging
declare global {
  interface Window {
    novelEditor?: EditorInstance;
    ___novelAdvEditorDebug?: boolean;
    ___novelDragHandleDebug?: boolean;
    _debugNovelEditor?: EditorInstance; // Add this for debugging
  }
}


// Enable debug mode
window.___novelAdvEditorDebug = true;
window.___novelDragHandleDebug = false;
export default TailwindAdvancedEditor;
