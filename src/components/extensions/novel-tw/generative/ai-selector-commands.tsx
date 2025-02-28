import { ArrowDownWideNarrow, Check, RefreshCcwDot, StepForward, WrapText, Image, Wand2, Sparkles, Pencil, ImageIcon, Plug, List, ArrowLeft } from "lucide-react";
import { getPrevText, useEditor } from "@/components/extensions/novel-src";
import { CommandGroup, CommandItem, CommandSeparator } from "@/components/ui/command";
import { nanoid } from "nanoid";
import CrazySpinner from "../ui/icons/crazy-spinner";

const options = [
  {
    value: "improve",
    label: "Improve writing",
    icon: RefreshCcwDot,
  },
  {
    value: "fix",
    label: "Fix grammar",
    icon: Check,
  },
  {
    value: "shorter",
    label: "Make shorter",
    icon: ArrowDownWideNarrow,
  },
  {
    value: "longer",
    label: "Make longer",
    icon: WrapText,
  },
];

interface ThreadgirlPrompt {
  _id: number;
  date: string;
  hash: string;
  name: string;
  prompt: string;
}

interface AISelectorCommandsProps {
  onSelect: (value: string, option: string, promptName?: string) => void;
  hasSelection: boolean;
  generatedImageUrl?: string | null;
  onInsertImage?: () => void;
  threadgirlPrompts?: ThreadgirlPrompt[] | null;
  showThreadgirlMenu?: boolean;
  onBackFromThreadgirl?: () => void;
  isLoadingThreadgirlPrompts?: boolean;
}

const AISelectorCommands = ({ 
  onSelect, 
  hasSelection, 
  generatedImageUrl, 
  onInsertImage,
  threadgirlPrompts,
  showThreadgirlMenu,
  onBackFromThreadgirl,
  isLoadingThreadgirlPrompts = false
}: AISelectorCommandsProps) => {
  const { editor } = useEditor();

  if (showThreadgirlMenu) {
    return (
      <div className="p-2">
        <CommandGroup>
          <CommandItem
            onSelect={() => onBackFromThreadgirl?.()}
            className="flex items-center"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span>Back to main menu</span>
          </CommandItem>
        </CommandGroup>
        
        {isLoadingThreadgirlPrompts ? (
          <div className="flex h-12 w-full items-center justify-center px-4 text-sm font-medium text-muted-foreground text-purple-500">
            <span className="mr-2">Loading prompts</span>
            <div className="ml-2 mt-1">
              <CrazySpinner />
            </div>
          </div>
        ) : threadgirlPrompts && threadgirlPrompts.length > 0 ? (
          <CommandGroup heading="Available Prompts">
            {threadgirlPrompts.map((prompt) => (
              <CommandItem
                key={`threadgirl-prompt-${prompt._id}`}
                onSelect={() => onSelect(prompt.prompt, "runThreadgirl", prompt.name)}
                className="flex items-center"
              >
                <span>{prompt.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No prompts available
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-2">
      {/* Generated image actions */}
      {generatedImageUrl && (
        <CommandGroup heading="Image Actions">
          <CommandItem
            onSelect={() => onInsertImage && onInsertImage()}
            className="flex items-center"
          >
            <StepForward className="mr-2 h-4 w-4" />
            <span>Insert image into document</span>
          </CommandItem>
          <CommandItem
            onSelect={() => onSelect("Generate another image", "generate-image")}
            className="flex items-center"
          >
            <RefreshCcwDot className="mr-2 h-4 w-4" />
            <span>Generate another image</span>
          </CommandItem>
        </CommandGroup>
      )}

      {/* Options that always show */}
      <CommandGroup heading="AI Actions">
        {!generatedImageUrl && (
          <>
            <CommandItem
              onSelect={() => onSelect("Generate an image", "generate-image")}
              className="flex items-center"
            >
              <ImageIcon className="mr-2 h-4 w-4" />
              <span>Generate an image</span>
            </CommandItem>
            
            <CommandItem
              onSelect={() => onSelect("Get prompts", "get-threadgirl-prompts")}
              className="flex items-center"
            >
              <List className="mr-2 h-4 w-4" />
              <span>Threadgirl</span>
            </CommandItem>
          </>
        )}
        
        {/* Options that only show when text is selected */}
        {hasSelection && (
          <>
            <CommandItem
              onSelect={() => onSelect("Improve writing", "improve")}
              className="flex items-center"
            >
              <RefreshCcwDot className="mr-2 h-4 w-4" />
              <span>Improve writing</span>
            </CommandItem>
            <CommandItem
              onSelect={() => onSelect("Fix spelling and grammar", "fix")}
              className="flex items-center"
            >
              <Check className="mr-2 h-4 w-4" />
              <span>Fix spelling and grammar</span>
            </CommandItem>
            <CommandItem
              onSelect={() => onSelect("Make shorter", "shorten")}
              className="flex items-center"
            >
              <ArrowDownWideNarrow className="mr-2 h-4 w-4" />
              <span>Make shorter</span>
            </CommandItem>
            <CommandItem
              onSelect={() => onSelect("Make longer", "lengthen")}
              className="flex items-center"
            >
              <WrapText className="mr-2 h-4 w-4" />
              <span>Make longer</span>
            </CommandItem>
            <CommandItem
              onSelect={() => onSelect("Change tone to professional", "professional")}
              className="flex items-center"
            >
              <Pencil className="mr-2 h-4 w-4" />
              <span>Change tone to professional</span>
            </CommandItem>
            <CommandItem
              onSelect={() => onSelect("Change tone to casual", "casual")}
              className="flex items-center"
            >
              <Pencil className="mr-2 h-4 w-4" />
              <span>Change tone to casual</span>
            </CommandItem>
            <CommandItem
              onSelect={() => onSelect("Simplify language", "simplify")}
              className="flex items-center"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              <span>Simplify language</span>
            </CommandItem>
          </>
        )}
        
        {/* Options that only show when no text is selected and no image is generated */}
        {!hasSelection && !generatedImageUrl && (
          <>
            <CommandItem
              onSelect={() => onSelect("Tell me a joke", "tell-joke")}
              className="flex items-center"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              <span>Tell me a joke</span>
            </CommandItem>
            <CommandItem
              onSelect={() => onSelect("Write a story", "story")}
              className="flex items-center"
            >
              <Pencil className="mr-2 h-4 w-4" />
              <span>Write a story</span>
            </CommandItem>
            <CommandItem
              onSelect={() => onSelect("Explain a concept", "explain")}
              className="flex items-center"
            >
              <Plug className="mr-2 h-4 w-4" />
              <span>Explain a concept</span>
            </CommandItem>
          </>
        )}
      </CommandGroup>
    </div>
  );
};

export default AISelectorCommands;
