import { CommandGroup, CommandItem, CommandSeparator } from "@/components/ui/command";
import { useEditor } from "@/components/extensions/novel-src";
import { Check, TextQuote, TrashIcon } from "lucide-react";
import { useEffect } from "react";

const AICompletionCommands = ({
  completion,
  onDiscard,
}: {
  completion: string;
  onDiscard: () => void;
}) => {
  const { editor } = useEditor();
  
  // Helper function to insert content below
  const insertBelow = () => {
    const selection = editor.view.state.selection;
    editor
      .chain()
      .focus()
      .insertContentAt(selection.to + 1, completion)
      .run();
    
    // Close the AI selector after inserting
    onDiscard();
  };
  
  return (
    <>
      <CommandGroup>
        <CommandItem
          className="gap-2 px-4"
          value="replace"
          onSelect={() => {
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
            
            // Close the AI selector after replacing
            onDiscard();
          }}
        >
          <Check className="h-4 w-4 text-muted-foreground" />
          Replace selection
        </CommandItem>
        <CommandItem
          className="gap-2 px-4"
          value="insert"
          onSelect={insertBelow}
        >
          <TextQuote className="h-4 w-4 text-muted-foreground" />
          Insert below
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />

      <CommandGroup>
        <CommandItem onSelect={onDiscard} value="thrash" className="gap-2 px-4">
          <TrashIcon className="h-4 w-4 text-muted-foreground" />
          Discard
        </CommandItem>
      </CommandGroup>
    </>
  );
};

export default AICompletionCommands;
