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

import Emoji, { gitHubEmojis } from '@/components/extensions/novel-tw/extensions/extension-emoji'
import Document from "@tiptap/extension-document";
import GlobalDragHandle from "@/components/extensions/novel-src/extensions/custom-drag-handle";
import AddLineHandle from "@/components/extensions/novel-src/extensions/custom-add-handle";

import { uploadFn } from "./image-upload";
import { TextButtons } from "./selectors/text-buttons";
import { slashCommand, suggestionItems } from "./slash-command";

import hljs from "highlight.js";
import { DragStateManager } from "@/components/extensions/novel-src/extensions/drag-state-manager";
import ClearFormatBackspace from "@/components/extensions/novel-tw/extensions/clear-format-backspace";

import GenerativeMenuSwitch from "@/components/extensions/novel-tw/generative/generative-menu-switch";
import { AIShortcut, SpaceAITrigger } from "@/components/extensions/novel-tw/generative/ai-shortcut";
import AITriggerManager from "@/components/extensions/novel-tw/generative/ai-trigger-manager";
import { removeAIHighlight } from "./generative/ai-highlight";

import ToggleBlock from "./extensions/toggle-block";
import ToggleInputRule from "./extensions/toggle-input-rule";

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
  Footnote,
  ToggleBlock,
  ToggleInputRule
];

// Update the props interface
interface TailwindAdvancedEditorProps {
  defaultValue?: string | undefined;
  onChange?: (content: string, wordCount?: number) => void;
  editorRef?: React.MutableRefObject<EditorInstance | null>;
  editorClasses?: string;
  containerClasses?: string;
  onWordCountChange?: (count: number) => void;
  onSaveStatusChange?: (status: string) => void;
}

// Update the component definition
const TailwindAdvancedEditor: React.FC<TailwindAdvancedEditorProps> = ({
  defaultValue,
  onChange,
  editorRef,
  onWordCountChange,
  onSaveStatusChange,
  editorClasses,
  containerClasses
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
  // Add a ref for the container element
  const containerRef = useRef<HTMLDivElement>(null);

  // Function to handle clicks on the container
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Only focus if we have an editor and the click wasn't directly on an editor element
    if (editor && containerRef.current) {
      // Check if the click target is not inside the editor content
      const editorElement = containerRef.current.querySelector('.ProseMirror');
      if (editorElement && !editorElement.contains(e.target as Node)) {
        // Focus the editor - but DON'T force cursor to the end
        // This change allows the cursor to stay where it was
        editor.commands.focus(); // Removed 'end' parameter
      }
    }
  }, [editor]);

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

    // Clear any AI highlights that might have persisted from a previous session
    removeAIHighlight(editorInstance);

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
  
  // Keep only drag handle related events here
  useEffect(() => {
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
    
    window.addEventListener('novel:add-block', handleAddBlock as EventListener);
    window.addEventListener('novel:drag-handle-command', handleDragHandleCommand as EventListener);
    
    return () => {
      window.removeEventListener('novel:add-block', handleAddBlock as EventListener);
      window.removeEventListener('novel:drag-handle-command', handleDragHandleCommand as EventListener);
    };
  }, [editor]);

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
    <div 
      className="relative" 
      ref={containerRef} 
      onClick={handleContainerClick}
    >
      <EditorRoot>
        <EditorContent
          initialContent={initialContent}
          extensions={extensions}
          className={`relative min-h-[500px] w-full max-w-screen-lg border-muted ${containerClasses}`}
          editorProps={{
            handleDOMEvents: {
              keydown: (_view, event) => handleCommandNavigation(event),
            },
            handlePaste: (view, event) => handleImagePaste(view, event, uploadFn),
            handleDrop: (view, event, _slice, moved) => handleImageDrop(view, event, moved, uploadFn),
            attributes: {
              class: `prose dark:prose-invert prose-headings:font-title font-default focus:outline-none ${editorClasses}`,
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
          
          {/* Add our AI Trigger Manager here */}
          <AITriggerManager onAIStateChange={(isOpen) => {
            // Optionally sync with the openAI state if needed
            if (isOpen !== openAI) {
              setOpenAI(isOpen);
            }
          }} />
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
