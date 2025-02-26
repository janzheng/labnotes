"use client";
import ReactDOM from "react-dom/client";
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

import GenerativeMenuSwitch from "./generative/generative-menu-switch";
import { uploadFn } from "./image-upload";
import { TextButtons } from "./selectors/text-buttons";
import { slashCommand, suggestionItems } from "./slash-command";
import { ContentItemMenu } from "./content-item-menu";

import hljs from "highlight.js";

// Customize the Document extension to support footnotes
const CustomDocument = Document.extend({
  content: "block+ footnotes?",
});

// Modify the extensions array to use the custom document
const extensions = [
  ...defaultExtensions.filter(extension => extension.name !== 'document'),
  CustomDocument,
  slashCommand, 
  Emoji.configure({
    emojis: gitHubEmojis,
    enableEmoticons: true,
  }),
  Footnotes, 
  FootnoteReference, 
  Footnote
];


const TailwindAdvancedEditor = ({ 
  defaultValue, 
  onChange 
}: { 
  defaultValue?: string | JSONContent;
  onChange?: (content: string) => void;
}) => {
  // Parse defaultValue if it's a string
  const parsedDefaultValue = typeof defaultValue === 'string' && defaultValue 
    ? JSON.parse(defaultValue) 
    : defaultValue;
    
  const [initialContent] = useState<JSONContent>(
    parsedDefaultValue || defaultEditorContent
  );
  
  const [saveStatus, setSaveStatus] = useState("Saved");
  const [charsCount, setCharsCount] = useState<number | undefined>(undefined);

  const [openNode, setOpenNode] = useState(false);
  const [openColor, setOpenColor] = useState(false);
  const [openLink, setOpenLink] = useState(false);
  const [openAI, setOpenAI] = useState(false);

  const [editor, setEditor] = useState<EditorInstance | null>(null);
  
  // Add a direct reference to track when the editor is ready
  const editorReady = useRef(false);

  const onEditorReady = useCallback((editorInstance: EditorInstance) => {
    console.log("Editor instance ready", editorInstance);
    setEditor(editorInstance);
    editorReady.current = true;
  }, []);

  // Add this effect to manually mount ContentItemMenu when editor is ready
  useEffect(() => {
    if (editor && editorReady.current) {
      console.log("Editor is ready, attempting to mount ContentItemMenu manually");
      
      // Create a container for the ContentItemMenu
      const container = document.createElement('div');
      container.className = 'content-item-menu-container';
      document.querySelector('.ProseMirror')?.parentElement?.appendChild(container);
      
      // Render ContentItemMenu into the container
      try {
        const root = ReactDOM.createRoot(container);
        root.render(<ContentItemMenu editor={editor} isEditable={true} />);
        console.log("ContentItemMenu manually mounted");
      } catch (error) {
        console.error("Error mounting ContentItemMenu:", error);
      }
    }
  }, [editor]);

  useEffect(() => {
    console.log("Setting up event listeners in TailwindAdvancedEditor");
    
    // Listen for the custom event to open the AI selector
    const handleOpenAISelector = (event: CustomEvent) => {
      console.log("[handleOpenAISelector] event", event);
      if (event.detail?.open) {
        setOpenAI(true);
      }
    };
    
    // Listen for the add block event
    const handleAddBlock = (event: CustomEvent) => {
      console.log("[handleAddBlock] event", event);
      if (event.detail?.position !== undefined) {
        // Get the editor instance
        const editor = document.querySelector('.ProseMirror')?.['editor'];
        if (editor) {
          console.log("Found editor, setting node selection at position", event.detail.position);
          // Set the cursor position
          editor.commands.setNodeSelection(event.detail.position);
          
          // Open the slash command menu
          console.log("Dispatching slash event");
          const slashEvent = new KeyboardEvent('keydown', {
            key: '/',
            code: 'Slash',
            keyCode: 191,
            which: 191,
            bubbles: true
          });
          document.activeElement?.dispatchEvent(slashEvent);
        } else {
          console.error("Could not find editor instance");
        }
      }
    };
    
    window.addEventListener('novel:open-ai-selector', handleOpenAISelector as EventListener);
    window.addEventListener('novel:add-block', handleAddBlock as EventListener);
    
    return () => {
      window.removeEventListener('novel:open-ai-selector', handleOpenAISelector as EventListener);
      window.removeEventListener('novel:add-block', handleAddBlock as EventListener);
    };
  }, []);

  useEffect(() => {
    if (editor) {
      console.log("Editor instance available for ContentItemMenu", editor);
      
      // Force a re-render of ContentItemMenu with a timeout
      setTimeout(() => {
        console.log("Attempting to force ContentItemMenu render");
        setEditor(prevEditor => {
          console.log("Re-setting editor to force re-render");
          return prevEditor; // Same reference, but forces re-render
        });
      }, 500);
    }
  }, [editor]);

  const debouncedUpdates = useDebouncedCallback(async (editor: EditorInstance) => {
    const wordCount = editor.storage.characterCount.words();
    setCharsCount(wordCount);
    setSaveStatus("Saved");
    
    // Call the onChange handler with the editor content
    if (onChange) {
      const jsonContent = editor.getJSON();
      onChange(JSON.stringify(jsonContent));
    }
  }, 500);

  return (
    <div className="relative">
      <div className="flex absolute right-5 top-5 z-10 mb-5 gap-2">
        <div className="rounded-lg bg-accent px-2 py-1 text-sm text-muted-foreground">{saveStatus}</div>
        <div className={charsCount ? "rounded-lg bg-accent px-2 py-1 text-sm text-muted-foreground" : "hidden"}>
          {charsCount} Words
        </div>
      </div>

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
            debouncedUpdates(editor);
            setSaveStatus("Unsaved");
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

export default TailwindAdvancedEditor;
