import React from "react";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import CrazySpinner from "@/components/ui/icons/crazy-spinner";
import { actions } from 'astro:actions';
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

// Define a type for threadgirl prompts
interface ThreadgirlPrompt {
  _id?: string;
  name: string;
  prompt: string;
  date?: string;
  hash?: string;
}

interface ThreadgirlMenuProps {
  onSelect: (value: string, option: string, promptName?: string) => void;
  onBack: () => void;
  selectionContent?: string;
  inputValue?: string;
  editor?: any;
  isLoadingThreadgirl?: boolean;
  setIsLoadingThreadgirl?: (isLoading: boolean) => void;
  loadingOperation?: string | null;
  setLoadingOperation?: (operation: string | null) => void;
}

const ThreadgirlMenu: React.FC<ThreadgirlMenuProps> = ({ 
  onSelect, 
  onBack,
  selectionContent = '',
  inputValue = '',
  editor,
  isLoadingThreadgirl = false,
  setIsLoadingThreadgirl = () => {},
  loadingOperation = null,
  setLoadingOperation = () => {}
}) => {
  const [threadgirlPrompts, setThreadgirlPrompts] = useState<ThreadgirlPrompt[] | null>(null);
  const [isLoadingThreadgirlPrompts, setIsLoadingThreadgirlPrompts] = useState(false);

  // Load prompts when component mounts
  useEffect(() => {
    handleGetThreadgirlPrompts();
  }, []);

  // Add handler for Enter key
  useEffect(() => {
    // Listen for Enter key event in the parent component's input field
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Enter key when:
      // 1. The user has entered some text
      // 2. We're not already loading a prompt
      // 3. We're not loading the prompt list
      if (e.key === 'Enter' && inputValue.trim() && !isLoadingThreadgirl && !isLoadingThreadgirlPrompts) {
        e.preventDefault();
        e.stopPropagation();
        
        // Show a visual feedback toast before running the prompt
        toast.loading("Running custom prompt...", {
          id: 'threadgirl-init',
          duration: 1000
        });
        
        // Run the custom prompt
        handleRunThreadgirlPrompt();
      }
    };

    // Add global event listener since our input is managed by parent
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [inputValue, isLoadingThreadgirl, isLoadingThreadgirlPrompts]);

  // Function to get Threadgirl prompts
  const handleGetThreadgirlPrompts = async () => {
    try {
      console.log("Getting available threadgirl prompts");
      setIsLoadingThreadgirlPrompts(true);
      setLoadingOperation('loading_prompts');
      
      const { data, error } = await actions.canvas.threadgirl({
        command: 'getThreadgirlPrompts',
        sources: [],
        prompts: [],
        query: "",
        url: '',
        useCache: true,
        saveCache: true,
      });

      if (error) throw error;
      
      console.log("Threadgirl prompts:", data.prompts);
      setThreadgirlPrompts(data.prompts || []);
      setIsLoadingThreadgirlPrompts(false);
      setLoadingOperation(null);
    } catch (error) {
      console.error("Error getting threadgirl prompts:", error);
      setIsLoadingThreadgirlPrompts(false);
      setLoadingOperation(null);
      toast.error("Failed to get threadgirl prompts");
    }
  };

  // Add this utility function somewhere in the file, outside the component
  const processThreadgirlResponse = (response: string): string => {
    try {
      // Check if response is an array and join if it is
      if (Array.isArray(response)) {
        return response.join('\n');
      }
      // Check if the response is wrapped in quotes
      const quotedMarkdownRegex = /^"(.*)"$/s;
      const match = response.match(quotedMarkdownRegex);
      
      if (match) {
        // Return the content inside the quotes
        return match[1];
      }
    } catch (error) {
      console.error("Error processing threadgirl response:", response, error);
    }
    
    // Return original if not quoted or if there was an error
    return response;
  };

  // Function to run a Threadgirl prompt
  const handleRunThreadgirlPrompt = async (promptName?: string) => {
    try {
      console.log(`[THREADGIRL-MENU] Running threadgirl prompt${promptName ? `: ${promptName}` : ''}`);
      console.log(`[THREADGIRL-MENU] Setting isLoadingThreadgirl to TRUE`);
      setIsLoadingThreadgirl(true);  // Use the prop setter
      setLoadingOperation('running_prompt');
      
      // Show a toast to indicate the prompt is running
      toast.loading(`Running ${promptName ? `"${promptName}"` : 'custom'} prompt...`, {
        id: 'threadgirl-running',
        duration: 3000
      });
      
      // Get selected text - first use the passed-in selection if available
      let selectedText = selectionContent.trim();
      
      // Only query editor for selection if no passed-in selection is available
      if (!selectedText && editor) {
        const slice = editor.state.selection.content();
        selectedText = editor.storage.markdown.serializer.serialize(slice.content).trim();
      }
      
      // Format the query based on the Threadgirl query format
      let queryText = inputValue.trim();
      
      // Add selected text to the query if it exists
      if (selectedText) {
        queryText = queryText 
          ? `${queryText} ${selectedText}` 
          : selectedText;
      }
      
      // Add prompt name in curly braces if provided
      if (promptName) {
        queryText = `${queryText} {${promptName}}`;
      }
      
      if (!queryText) {
        toast.error("Please enter a prompt, select text, or choose a predefined prompt");
        console.log(`[THREADGIRL-MENU] No query text, setting isLoadingThreadgirl to FALSE`);
        setIsLoadingThreadgirl(false);  // Use the prop setter
        setLoadingOperation(null);
        return;
      }

      console.log("[THREADGIRL-MENU] Sending threadgirl query:", queryText);
      
      try {
        const { data, error } = await actions.canvas.threadgirl({
          command: 'runThreadgirl',
          sources: [],
          prompts: [], // No need for separate prompts array as it's included in the query
          query: queryText,
          url: '',
          useCache: true,
          saveCache: true,
        });
  
        if (error) {
          console.error("[THREADGIRL-MENU] Threadgirl API error:", error);
          toast.error(`Threadgirl error: ${error}`);
          console.log(`[THREADGIRL-MENU] API error, setting isLoadingThreadgirl to FALSE`);
          setIsLoadingThreadgirl(false);  // Use the prop setter
          setLoadingOperation(null);
          return;
        }
        
        // Ensure we have a result before proceeding
        if (!data || !data.result) {
          toast.error("Threadgirl returned an empty result");
          console.log(`[THREADGIRL-MENU] Empty result, setting isLoadingThreadgirl to FALSE`);
          setIsLoadingThreadgirl(false);  // Use the prop setter
          setLoadingOperation(null);
          return;
        }


        console.log("[THREADGIRL-MENU] Received Threadgirl response:", data);

        // Process the result to handle quoted content
        const processedResult = processThreadgirlResponse(data.result);
        
        // Dismiss the loading toast
        toast.dismiss('threadgirl-running');
        
        // Show success toast
        toast.success(`${promptName ? `"${promptName}"` : 'Custom'} prompt completed!`);
        
        console.log("[THREADGIRL-MENU] Calling onSelect with Threadgirl result");
        // Pass the processed result back to the parent component
        onSelect(processedResult, "threadgirl", promptName);
        
        // Important: We're deliberately NOT setting isLoadingThreadgirl to false here
        // because the parent component (AI Selector) needs to know we're still in the 
        // loading state until it finishes processing the result
        // The parent will handle resetting this state via its own UI updates
        console.log("[THREADGIRL-MENU] Leaving isLoadingThreadgirl as TRUE for parent to handle");
        // Don't reset loadingOperation either, let the parent handle it
      } catch (apiError) {
        console.error("[THREADGIRL-MENU] API error when running threadgirl:", apiError);
        toast.error("Failed to communicate with Threadgirl API");
        toast.dismiss('threadgirl-running');
        console.log(`[THREADGIRL-MENU] API exception, setting isLoadingThreadgirl to FALSE`);
        setIsLoadingThreadgirl(false);  // Use the prop setter
        setLoadingOperation(null);
      }
    } catch (error) {
      console.error("[THREADGIRL-MENU] Error running threadgirl prompt:", error);
      console.log(`[THREADGIRL-MENU] Exception, setting isLoadingThreadgirl to FALSE`);
      setIsLoadingThreadgirl(false);  // Use the prop setter
      setLoadingOperation(null);
      toast.dismiss('threadgirl-running');
      toast.error("Failed to run threadgirl prompt");
    }
  };

  return (
    <div className="threadgirl-menu">
      <CommandGroup>
        <CommandItem
          onSelect={onBack}
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
          <div className="threadgirl-prompts-container">
            {threadgirlPrompts.map((prompt) => (
              <CommandItem
                key={`threadgirl-prompt-${prompt._id || prompt.name}`}
                onSelect={() => {
                  // Get selected text - first try using passed-in selection
                  let selectedText = selectionContent.trim();
                  
                  // Only fall back to editor selection if no passed-in selection
                  if (!selectedText && editor) {
                    // Get plain text directly from the selection
                    const { from, to } = editor.state.selection;
                    selectedText = editor.state.doc.textBetween(from, to, ' ').trim();
                  }
                  
                  // If there's selected text, use it instead of the placeholder
                  if (selectedText) {
                    // Run the prompt with the selected text
                    handleRunThreadgirlPrompt(prompt.name);
                  } else {
                    // No selection, use the placeholder as before
                    onSelect(`{${prompt.name}} [add your text or link]`, "set_input");
                  }
                }}
                className="flex items-center"
              >
                <span>{prompt.name}</span>
              </CommandItem>
            ))}
          </div>
        </CommandGroup>
      ) : (
        <div className="p-4 text-center text-sm text-muted-foreground">
          No prompts available
        </div>
      )}
      
      {/* Custom Prompt Instructions - only show when not loading */}
      {!isLoadingThreadgirlPrompts && !isLoadingThreadgirl && threadgirlPrompts && threadgirlPrompts.length > 0 && (
        <div className="px-4 py-2 text-xs text-muted-foreground border-t mt-2">
          <p className="mb-1 font-medium">Using Custom Prompt:</p>
          <p>Type in the search box above and press Enter to run a custom prompt.</p>
          <p className="mt-1">
            {inputValue.trim() && (
              <span className="text-purple-400">Ready to run custom prompt. Press Enter to proceed.</span>
            )}
          </p>
        </div>
      )}
      
      {/* Threadgirl loading state - show prominently when running a prompt */}
      {isLoadingThreadgirl && (
        <div className="flex h-16 w-full items-center justify-center px-4 py-4 text-sm font-medium text-purple-500 bg-purple-50 border-t mt-2">
          <span className="mr-2 font-semibold">Running Threadgirl prompt</span>
          <div className="ml-2">
            <CrazySpinner />
          </div>
        </div>
      )}
      
    </div>
  );
};

export default ThreadgirlMenu;

// Export the utility functions for direct use in other components
export { type ThreadgirlPrompt }; 