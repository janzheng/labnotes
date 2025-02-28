"use client";

import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";

import { useCompletion } from "@ai-sdk/react";
import { ArrowUp, ImageIcon, ArrowLeft } from "lucide-react";
import { useEditor } from "@/components/extensions/novel-src";
import { addAIHighlight } from "@/components/extensions/novel-src";
import { useState, useRef, useEffect } from "react";
import Markdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "../ui/button";
import CrazySpinner from "../ui/icons/crazy-spinner";
import Magic from "../ui/icons/magic";
import { ScrollArea } from "../ui/scroll-area";
import AIPostCompletionCommands from "./ai-post-completion-command";
import AISelectorCommands from "./ai-selector-commands";
import { actions } from 'astro:actions';
//TODO: I think it makes more sense to create a custom Tiptap extension for this functionality https://tiptap.dev/docs/editor/ai/introduction

interface AISelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromSlashCommand?: boolean;
  isFloating?: boolean;
  selectionContent?: string;
}

// Define a type for threadgirl prompts
interface ThreadgirlPrompt {
  _id?: string;
  name: string;
  prompt: string;
}

export function AISelector({ open, onOpenChange, fromSlashCommand = false, isFloating = false, selectionContent = '' }: AISelectorProps) {
  const { editor } = useEditor();
  const [inputValue, setInputValue] = useState("");
  const [messageHistory, setMessageHistory] = useState<Array<{ role: string, content: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isImageMode, setIsImageMode] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [filteredOptionsExist, setFilteredOptionsExist] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string>("");
  const commandRef = useRef<HTMLDivElement>(null);
  const [prompts, setPrompts] = useState<any[] | null>(null);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [threadgirlPrompts, setThreadgirlPrompts] = useState<any[] | null>(null);
  const [isLoadingThreadgirlPrompts, setIsLoadingThreadgirlPrompts] = useState(false);
  const [showThreadgirlMenu, setShowThreadgirlMenu] = useState(false);
  const [isLoadingThreadgirl, setIsLoadingThreadgirl] = useState(false);
  const [lastPrompt, setLastPrompt] = useState("");
  const [showCompletion, setShowCompletion] = useState(true);

  // Log the opening state for debugging
  useEffect(() => {
    if (open) {
      console.log('[AI-SELECTOR] Opened with fromSlashCommand:', fromSlashCommand, 'isFloating:', isFloating);
    }
  }, [open, fromSlashCommand, isFloating]);

  // Aggressive focus management when selector opens
  useEffect(() => {
    if (!open) return;

    // Immediately try to focus
    const focusInput = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    // Focus immediately
    focusInput();

    // And after a short delay (needed for some browsers/situations)
    const immediateTimeout = setTimeout(focusInput, 10);
    const shortTimeout = setTimeout(focusInput, 50);
    const mediumTimeout = setTimeout(focusInput, 100);

    // Keep checking focus for a period to ensure TipTap doesn't steal it back
    const interval = setInterval(() => {
      if (document.activeElement !== inputRef.current) {
        focusInput();
      }
    }, 50);

    // Stop the interval after giving it enough time to stabilize
    const cleanupTimeout = setTimeout(() => {
      clearInterval(interval);
    }, 500);

    return () => {
      clearTimeout(immediateTimeout);
      clearTimeout(shortTimeout);
      clearTimeout(mediumTimeout);
      clearTimeout(cleanupTimeout);
      clearInterval(interval);
    };
  }, [open]);

  const { completion, complete, isLoading } = useCompletion({
    streamProtocol: "data",
    api: "/api/generate",
    onResponse: async (response) => {
      console.log("AI Response:", {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        // Clone the response before reading it
        const clonedResponse = response.clone();
        const errorText = await clonedResponse.text();
        console.error("AI Response error details:", errorText);
        toast.error(errorText || response.statusText);
        return;
      }
    },
    onError: (e) => {
      console.error("AI Completion error:", {
        message: e.message,
        cause: e.cause,
        stack: e.stack
      });
      toast.error(e.message);
    },
    onFinish: (prompt, result) => {
      console.log("AI Completion finished:", result);

      // Use the actual completion value, not the result parameter
      setMessageHistory(prev => [
        ...prev,
        { role: "assistant", content: result }
      ]);

      // If no specific action was set, set a default one to ensure commands show up
      if (!action) {
        setAction("default_completion");
      }

      // For selection-based transformations, replace the selected text
      if (action === "transform_selection") {
        // The useEffect will handle the replacement when isLoading becomes false
      }
    },
  });

  // Track the current action being performed
  const [action, setAction] = useState<string | null>(null);

  // Define what makes a completion visible - update this to be more inclusive
  const hasCompletion = completion.length > 0;

  const handleComplete = async () => {
    try {
      // Get selected text if any - first use passed-in selection if available
      let selectedText = selectionContent;
      
      // Only query editor for selection if no selection was passed in
      if (!selectedText && editor) {
        const slice = editor.state.selection.content();
        selectedText = editor.storage.markdown.serializer.serialize(slice.content);
      }

      // Prepare the message to send based on selection and input
      let textToSend = '';
      const hasSelection = selectedText.trim().length > 0;
      const hasInput = inputValue.trim().length > 0;

      if (hasSelection && hasInput) {
        // Both selection and input - format with instruction tags
        textToSend = `<instruction>${inputValue.trim()}</instruction>\n\n${selectedText.trim()}`;
      } else if (hasSelection) {
        // Only selection
        textToSend = selectedText.trim();
      } else if (hasInput) {
        // Only input
        textToSend = inputValue.trim();
      } else {
        toast.error("Please enter a message or select text");
        return;
      }

      // Add user message to history before sending
      const newUserMessage = { role: "user", content: textToSend };
      setMessageHistory(prev => [...prev, newUserMessage]);

      console.log("Sending to AI:", {
        prompt: textToSend,
        option: "zap",
        command: inputValue,
        messageHistory: [...messageHistory, newUserMessage]
      });

      // Save the prompt before sending
      setLastPrompt(inputValue);

      // Set a default action to ensure completion commands show up
      setAction("default_completion");

      // Send the complete message history to maintain context
      await complete(textToSend, {
        body: {
          prompt: textToSend,
          option: "zap",
          command: inputValue,
          messageHistory: [...messageHistory, newUserMessage]
        },
      });
      setInputValue("");
    } catch (error) {
      console.error("Error in handleComplete:", error);
      toast.error("Failed to send request to AI");
    }
  };

  const handleGenerateImage = async () => {
    if (!inputValue.trim()) {
      toast.error("Please enter an image description");
      return;
    }

    try {
      setIsGeneratingImage(true);
      // Save a copy of the prompt
      setImagePrompt(inputValue.trim());

      console.log("Generating image with prompt:", inputValue);

      // Use the Astro action instead of fetch API
      const { data, error } = await actions.canvas.generateImage({
        prompt: inputValue.trim(),
        model: 'recraft-ai/recraft-v3',
        provider: 'replicate',
        projectId: 'current-project', // This will need to be replaced with actual project ID
        componentIndex: 0, // This will need to be replaced with actual component index
      });

      if (error) {
        console.error("Error generating image:", error);
        throw new Error("Failed to generate image");
      }

      // Set the generated image URL from the action response
      setGeneratedImageUrl(data.imageUrl);
      setIsGeneratingImage(false);
      setInputValue("");
      toast.success("Image generated successfully!");

    } catch (error) {
      console.error("Error generating image:", error);
      setIsGeneratingImage(false);
      toast.error("Failed to generate image");
    }
  };

  // Add a debug button to check the message history
  // We can remove this later once everything is working
  const debugMessageHistory = () => {
    console.log("Current message history:", messageHistory);
    console.log("Current completion:", completion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Remove this block that auto-inserts on empty Enter
    // if (e.key === 'Enter' && !inputValue.trim() && hasCompletion) {
    //   e.preventDefault();
    //   insertBelow();
    //   return;
    // }
    
    if (e.key === 'Enter' && inputValue.trim()) {
      // Check if there's a selected item in the command menu
      const selectedElement = commandRef.current?.querySelector('[data-selected="true"]') as HTMLElement;

      // If there's a selected item, check if its text matches the input
      if (selectedElement) {
        const selectedText = selectedElement.textContent?.trim();

        // If the selected text doesn't match the input, let Command handle it
        if (selectedText && selectedText !== inputValue.trim()) {
          return;
        }
      }

      // Otherwise, handle as a direct message
      e.preventDefault();
      if (isImageMode) {
        handleGenerateImage();
      } else if (showThreadgirlMenu) {
        // If in Threadgirl submenu, run the custom prompt
        handleRunThreadgirlPrompt();
      } else {
        handleComplete();
      }
    }

    // Discard completion or close the modal when backspace is pressed on empty input
    if (e.key === 'Backspace' && !inputValue) {
      e.preventDefault();
      
      if (showThreadgirlMenu) {
        // If in Threadgirl submenu, go back to main menu instead of closing
        console.log('[AI-SELECTOR] Going back to main menu from Threadgirl submenu');
        setShowThreadgirlMenu(false);
      } else if (hasCompletion) {
        console.log('[AI-SELECTOR] Discarding completion on empty backspace');
        // Discard the completion and clean up
        if (editor) {
          editor.chain().unsetHighlight().focus().run();
        }
        // Reset the message history or handle any other cleanup
        setMessageHistory([]);
        onOpenChange(false);
      } else {
        console.log('[AI-SELECTOR] Closing on empty backspace');
        onOpenChange(false);
      }
    }
  };

  // Handle command selection including the new image generation option
  const handleCommandSelect = async (value: string, option: string, promptName?: string) => {
    if (option === "generate-image") {
      setIsImageMode(true);
      setInputValue("");
    } else if (option === "get-threadgirl-prompts") {
      try {
        await handleGetThreadgirlPrompts();
        // The setShowThreadgirlMenu(true) is now called inside handleGetThreadgirlPrompts
      } catch (error) {
        console.error("Error in handleCommandSelect:", error);
      }
    } else if (option === "runThreadgirl" && promptName) {
      handleRunThreadgirlPrompt(promptName);
    } else if (option === "tell-joke") {
      setInputValue("Tell me a joke");
    } else if (option === "story") {
      setInputValue("Write a story about ");
    } else if (option === "explain") {
      setInputValue("Explain the concept of ");
    } else if (hasSelection(editor) && ["improve", "fix", "shorten", "lengthen", "professional", "casual", "simplify"].includes(option)) {
      // For selection-based options, automatically submit with the selected text
      // First use passed-in selection if available
      let selectedText = selectionContent;
      
      // Only query editor for selection if no selection was passed in
      if (!selectedText && editor) {
        const slice = editor.state.selection.content();
        selectedText = editor.storage.markdown.serializer.serialize(slice.content);
      }

      if (!selectedText.trim()) {
        toast.error("No text selected to transform");
        return;
      }

      // Format the prompt with instruction and selected text
      const formattedPrompt = `<instruction>${value}</instruction>\n\n${selectedText.trim()}`;

      // Add user message to history
      const newUserMessage = { role: "user", content: formattedPrompt };
      setMessageHistory(prev => [...prev, newUserMessage]);

      // Set the current action
      setAction("transform_selection");

      console.log("Auto-submitting selection with command:", {
        prompt: selectedText,
        option: option,
        command: value,
        messageHistory: [...messageHistory, newUserMessage],
        action: "transform_selection"
      });

      // Send to AI - use the formattedPrompt as the main prompt
      complete(formattedPrompt, {
        body: {
          prompt: selectedText,  // Original text for reference
          option: option,
          command: value,
          action: "transform_selection",
          messageHistory: [...messageHistory, newUserMessage]
        },
      });

      // Don't close the selector immediately - wait for completion
    } else {
      setAction(null);
      complete(value, { body: { option } });
    }
  };

  // Helper function to check if there's a selection
  const hasSelection = (editor: any) => {
    if (selectionContent && selectionContent.trim().length > 0) return true;
    if (!editor) return false;
    const selection = editor.state.selection;
    return selection.from !== selection.to;
  };

  const resetImageGeneration = () => {
    setIsImageMode(false);
    setGeneratedImageUrl(null);
    setInputValue("");
    setImagePrompt("");
  };

  // We'll keep replaceSelection for the transform_selection action only
  const replaceSelection = () => {
    if (!editor) return;

    const { from, to } = editor.state.selection;

    // Replace the selected text with the completion
    editor.chain()
      .focus()
      .insertContentAt(
        {
          from: from,
          to: to,
        },
        completion
      )
      .run();

    // Close the selector after replacing
    onOpenChange(false);
  };

  // Modify the function to handle getting prompts using the existing threadgirlAction
  const handleGetThreadgirlPrompts = async () => {
    try {
      console.log("Getting available threadgirl prompts");
      setIsLoadingThreadgirlPrompts(true);
      
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
      
      // Explicitly set the menu to show after loading prompts
      setShowThreadgirlMenu(true);
      setIsLoadingThreadgirlPrompts(false);
    } catch (error) {
      console.error("Error getting threadgirl prompts:", error);
      setIsLoadingThreadgirlPrompts(false);
      toast.error("Failed to get threadgirl prompts");
    }
  };

  // Define the handleRunThreadgirlPrompt function
  const handleRunThreadgirlPrompt = async (promptName?: string) => {
    try {
      console.log(`Running threadgirl prompt${promptName ? `: ${promptName}` : ''}`);
      setIsLoadingThreadgirl(true);
      
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
        setIsLoadingThreadgirl(false);
        return;
      }

      console.log("Sending threadgirl query:", queryText);
      
      const { data, error } = await actions.canvas.threadgirl({
        command: 'runThreadgirl',
        sources: [],
        prompts: [], // No need for separate prompts array as it's included in the query
        query: queryText,
        url: '',
        useCache: true,
        saveCache: true,
      });

      if (error) throw error;
      
      console.log("Threadgirl response:", data);
      
      // Add the response to the message history
      if (data.result) {
        // Add user message to history
        const newUserMessage = { role: "user", content: queryText };
        setMessageHistory(prev => [
          ...prev,
          newUserMessage,
          { role: "assistant", content: data.result }
        ]);
        
        // Set the completion directly
        complete(data.result, {
          body: {
            prompt: queryText,
            option: "threadgirl",
            command: promptName || "custom",
            messageHistory: [...messageHistory, newUserMessage]
          },
        });
      }
      
      setIsLoadingThreadgirl(false);
      setInputValue("");
      setShowThreadgirlMenu(false);
    } catch (error) {
      console.error("Error running threadgirl prompt:", error);
      setIsLoadingThreadgirl(false);
      toast.error("Failed to run threadgirl prompt");
    }
  };

  // Add a useEffect to handle the ignore_completion action
  useEffect(() => {
    if (action === "ignore_completion") {
      // Reset the action
      setAction(null);
      
      // The UI will now show the command menu instead of the completion
      // because we're conditionally rendering based on hasCompletion
      // but we've applied a hack to ignore it
    }
  }, [action]);

  // Ensure the action is maintained throughout the completion process
  useEffect(() => {
    // When loading starts, make sure we have an action set
    if (isLoading && !action) {
      setAction("default_completion");
    }
    
    // When loading finishes and we have a completion but no specific action
    if (!isLoading && completion.length > 0 && !action) {
      setAction("default_completion");
    }
  }, [isLoading, completion, action]);

  useEffect(() => {
    // When loading finishes and we have a completion, show it
    if (!isLoading && completion.length > 0) {
      setShowCompletion(true);
    }
  }, [isLoading, completion]);

  return (
    <Command
      ref={commandRef}
      className={`w-[350px] ai-selector ${isFloating ? 'in-floating-container' : ''}`}
    >
      <CommandList>
        {hasCompletion && showCompletion && !isImageMode && (
          <div className="flex max-h-[900px]">
            <ScrollArea>
              <div className="prose p-2 px-4 prose-sm">
                <Markdown>{completion}</Markdown>
              </div>
            </ScrollArea>
          </div>
        )}

        {isImageMode && generatedImageUrl && (
          <div className="flex flex-col items-center p-2">
            <img
              src={generatedImageUrl}
              alt="AI Generated"
              className="max-w-full max-h-[300px] rounded-md mb-2"
            />
            <div className="text-sm text-center text-muted-foreground mt-2">
              Image generated based on your prompt
            </div>
            <div className="text-xs text-center text-muted-foreground mt-1 italic">
              "{imagePrompt}"
            </div>
          </div>
        )}

        {/* Debug button - can be removed after debugging */}
        <button
          onClick={debugMessageHistory}
          className="hidden text-xs text-gray-500 hover:text-gray-700"
        >
          Debug History
        </button>

        {(isLoading || isGeneratingImage || isLoadingThreadgirl) && (
          <div className="flex h-12 w-full items-center px-4 text-sm font-medium text-muted-foreground text-purple-500">
            <Magic className="mr-2 h-4 w-4 shrink-0" />
            {isImageMode 
              ? "Generating image" 
              : isLoadingThreadgirl 
                ? "Running prompt" 
                : "AI is thinking"}
            <div className="ml-2 mt-1">
              <CrazySpinner />
            </div>
          </div>
        )}

        {!isLoading && !isGeneratingImage && !isLoadingThreadgirl && (
          <>
            <div className="relative">
              <CommandInput
                ref={inputRef}
                value={inputValue}
                onValueChange={setInputValue}
                autoFocus
                placeholder={
                  showThreadgirlMenu
                    ? "Search prompts or enter custom prompt..."
                    : isImageMode 
                      ? "Describe the image you want to generate..." 
                      : hasCompletion 
                        ? "Tell AI what to do next" 
                        : editor?.state.selection.content().size > 0
                          ? "Ask AI to edit or improve..."
                          : "Ask AI anything..."
                }
                onFocus={() => {
                  // Only add AI highlight for direct AI button clicks, not slash or space commands
                  if (!fromSlashCommand && !isFloating && !isImageMode) {
                    addAIHighlight(editor);
                  }
                }}
                onClick={(e) => {
                  // Prevent event from bubbling up to TipTap
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // Force focus on input
                  if (inputRef.current) {
                    inputRef.current.focus();
                  }
                }}
                onKeyDown={handleKeyDown}
              />
              <Button
                size="icon"
                className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-purple-500 hover:bg-purple-900"
                onClick={
                  isImageMode 
                    ? handleGenerateImage 
                    : showThreadgirlMenu 
                      ? () => handleRunThreadgirlPrompt() 
                      : handleComplete
                }
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
            
            {isImageMode && !generatedImageUrl ? (
              <div className="p-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={resetImageGeneration}
                >
                  Cancel Image Generation
                </Button>
              </div>
            ) : isImageMode && generatedImageUrl ? (
              <AISelectorCommands
                onSelect={handleCommandSelect}
                hasSelection={editor?.state.selection.content().size > 0}
                generatedImageUrl={generatedImageUrl}
                onInsertImage={() => {
                  // Insert the image at the cursor position
                  if (editor) {
                    editor.chain().focus().insertContent(`![Generated Image](${generatedImageUrl})`).run();
                    onOpenChange(false);
                  }
                }}
              />
            ) : (hasCompletion && showCompletion) ? (
              // Show post-completion commands only when both conditions are true
              <AIPostCompletionCommands
                onDiscard={() => {
                  // Reset states but keep the selector open to show the AI menu
                  if (editor) {
                    editor.chain().unsetHighlight().focus().run();
                  }
                  
                  // Restore the last prompt to the input
                  setInputValue(lastPrompt);
                  
                  // Explicitly hide the completion UI
                  setShowCompletion(false);
                  
                  // No need for action state anymore since we have direct control
                }}
                onClose={() => {
                  // Completely close the selector
                  if (editor) {
                    editor.chain().unsetHighlight().focus().run();
                  }
                  onOpenChange(false);
                }}
                completion={completion}
                handleRunThreadgirlPrompt={handleRunThreadgirlPrompt}
                originalPrompt={lastPrompt}
              />
            ) : (
              <>
                {/* Show threadgirl submenu if active - completely separate section */}
                {showThreadgirlMenu ? (
                  // Threadgirl submenu UI
                  <div className="">
                    <CommandGroup heading="Threadgirl Prompts">
                      <CommandItem
                        onSelect={() => setShowThreadgirlMenu(false)}
                        className="flex items-center"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        <span>Back to main menu</span>
                      </CommandItem>
                    
                      {/* Loading state for prompts */}
                      {isLoadingThreadgirlPrompts ? (
                        <div className="flex h-12 w-full items-center justify-center px-4 text-sm font-medium text-muted-foreground text-purple-500">
                          <span className="mr-2">Loading prompts</span>
                          <div className="ml-2 mt-1">
                            <CrazySpinner />
                          </div>
                        </div>
                      ) : threadgirlPrompts && threadgirlPrompts.length > 0 ? (
                        // Prompt list - these should receive focus with arrow navigation
                        threadgirlPrompts.map((prompt) => (
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
                                // Set input value with the selected text instead of placeholder
                                setInputValue(`{${prompt.name}} ${selectedText}`);
                              } else {
                                // No selection, use the placeholder as before
                                setInputValue(`{${prompt.name}} [add your text or link]`);
                              }
                              
                              // Focus the input field
                              if (inputRef.current) {
                                inputRef.current.focus();
                                // If no selection, position cursor after prompt name but before the suggestion text
                                if (!selectedText) {
                                  const cursorPosition = `{${prompt.name}} `.length;
                                  setTimeout(() => {
                                    if (inputRef.current) {
                                      inputRef.current.setSelectionRange(cursorPosition, inputRef.current.value.length);
                                    }
                                  }, 10);
                                }
                              }
                            }}
                            className="flex items-center"
                          >
                            <span>{prompt.name}</span>
                          </CommandItem>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No prompts available
                        </div>
                      )}
                    </CommandGroup>
                  </div>
                ) : (
                  // Regular AI selector commands (only shown when not in Threadgirl menu)
                  <AISelectorCommands
                    onSelect={handleCommandSelect}
                    hasSelection={editor?.state.selection.content().size > 0}
                  />
                )}
              </>
            )}
          </>
        )}

        <CommandEmpty>
          {showThreadgirlMenu 
            ? "Press Enter to threadgirl"
            : `Press Enter to ${isImageMode ? "generate image" : "send message"}`}
        </CommandEmpty>
      </CommandList>
    </Command>
  );
}
