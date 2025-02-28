import { EditorProvider } from "@tiptap/react";
import type { EditorProviderProps, JSONContent, Editor as TiptapEditor } from "@tiptap/react";
import { Provider } from "jotai";
import { forwardRef, useRef } from "react";
import type { FC, ReactNode } from "react";
import tunnel from "tunnel-rat";
import { novelStore } from "../utils/store";
import { EditorCommandTunnelContext } from "./editor-command";

export interface EditorProps {
  readonly children: ReactNode;
  readonly className?: string;
}

interface EditorRootProps {
  readonly children: ReactNode;
}

export const EditorRoot: FC<EditorRootProps> = ({ children }) => {
  const tunnelInstance = useRef(tunnel()).current;

  return (
    <Provider store={novelStore}>
      <EditorCommandTunnelContext.Provider value={tunnelInstance}>{children}</EditorCommandTunnelContext.Provider>
    </Provider>
  );
};

export type EditorContentProps = Omit<EditorProviderProps, "content"> & {
  readonly children?: ReactNode;
  readonly className?: string;
  readonly initialContent?: JSONContent;
  readonly onReady?: (editor: TiptapEditor) => void;
};

export const EditorContent = forwardRef<HTMLDivElement, EditorContentProps>(
  ({ className, children, initialContent, onReady, ...rest }, ref) => {
    const editorRef = useRef<TiptapEditor | null>(null);
    
    const handleEditorCreated = (editor: TiptapEditor) => {
      editorRef.current = editor;
      
      if (onReady) {
        onReady(editor);
      }
    };
    
    return (
      <div ref={ref} className={className}>
        <EditorProvider 
          {...rest}
          content={initialContent} 
          onBeforeCreate={({ editor }) => {
            if (rest.onBeforeCreate) {
              rest.onBeforeCreate({ editor });
            }
          }}
          onTransaction={({ editor, transaction }) => {
            if (rest.onTransaction) {
              rest.onTransaction({ editor, transaction });
            }
          }}
          onCreate={({ editor }) => {
            handleEditorCreated(editor);
            
            if (rest.onCreate) {
              rest.onCreate({ editor });
            }
          }}
        >
          {children}
        </EditorProvider>
      </div>
    );
  },
);

EditorContent.displayName = "EditorContent";
