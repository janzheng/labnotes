import { CommandGroup, CommandItem, CommandSeparator } from "@/components/ui/command";
import { useEditor } from "@/components/extensions/novel-src";
import { Check, TextQuote, TrashIcon, Hash } from "lucide-react";
import { useEffect } from "react";

const AIPostCompletionCommands = ({
  completion,
  onDiscard,
  onClose,
  originalPrompt,
  handleRunThreadgirlPrompt,
}: {
  completion: string;
  onDiscard: () => void;
  onClose: () => void;
  originalPrompt?: string;
  handleRunThreadgirlPrompt?: (promptName?: string) => void;
}) => {
  const { editor } = useEditor();
  
  // Helper function to insert content below
  const insertBelow = () => {
    if (!editor) return;
    
    const selection = editor.view.state.selection;
    editor
      .chain()
      .focus()
      .insertContentAt(selection.to + 1, completion)
      .run();
    
    // Close the AI selector completely after inserting
    onClose();
  };

  return (
    <>
      <CommandGroup>
        <CommandItem
          className="gap-2 px-4"
          value="insert"
          onSelect={insertBelow}
        >
          <TextQuote className="h-4 w-4 text-muted-foreground" />
          Insert below
        </CommandItem>
        <CommandItem
          className="gap-2 px-4"
          value="replace"
          onSelect={() => {
            if (!editor) return;
            
            const selection = editor.view.state.selection;

            editor
              .chain()
              .focus()
              .insertContentAt(
                {
                  from: selection.from,
                  to: selection.to,
                },
                completion,
              )
              .run();

            // Close the AI selector completely after replacing
            onClose();
          }}
        >
          <Check className="h-4 w-4 text-muted-foreground" />
          Replace selection
        </CommandItem>
        
      </CommandGroup>
      <CommandSeparator />

      <CommandGroup>
        <CommandItem onSelect={onDiscard} value="back" className="gap-2 px-4">
          <TrashIcon className="h-4 w-4 text-muted-foreground" />
          Discard & return to AI menu
        </CommandItem>
      </CommandGroup>
    </>
  );
};

export default AIPostCompletionCommands;
