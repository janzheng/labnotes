"use client";

import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";

import { useCompletion } from "@ai-sdk/react";
import { ArrowUp, ArrowLeft } from "lucide-react";
import { useEditor } from "@/components/extensions/novel-src";
import { addAIHighlight } from "@/components/extensions/novel-src";
import { useState, useRef, useEffect } from "react";
import Markdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import CrazySpinner from "@/components/ui/icons/crazy-spinner";
import Magic from "@/components/ui/icons/magic";
import { ScrollArea } from "@/components/ui/scroll-area";
import AIPostCompletionCommands from "./ai-post-completion-command";
import AISelectorCommands from "./ai-selector-commands";
import { actions } from 'astro:actions';
import React from "react";

// Import new modular components
import ThreadgirlMenu from "./threadgirl/threadgirl-menu";
import ImageGeneratorMenu from "./image-gen/image-generator-menu";

// Import shared types
import { 
  AISelectorMode, 
  type AISelectorProps, 
  type AIMessage, 
  AI_ACTIONS 
} from "./utils/ai-selector-types";

export function AISelector({ open, onOpenChange, fromSlashCommand = false, isFloating = false, selectionContent = '' }: AISelectorProps) {
  const { editor } = useEditor();
  const [inputValue, setInputValue] = useState("");
  const [messageHistory, setMessageHistory] = useState<Array<AIMessage>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<AISelectorMode>(AISelectorMode.DEFAULT);
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
  const [isLoadingThreadgirl, setIsLoadingThreadgirl] = useState(false);
  const [lastPrompt, setLastPrompt] = useState("");
  const [showCompletion, setShowCompletion] = useState(true);
  // Add a dedicated state for Threadgirl results
  const [threadgirlResult, setThreadgirlResult] = useState<string | null>(null);
  const [showThreadgirlResult, setShowThreadgirlResult] = useState(false);
  // Add a dedicated state to track the current loading operation type
  const [loadingOperation, setLoadingOperation] = useState<string | null>(null);

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
        setAction(AI_ACTIONS.DEFAULT_COMPLETION);
      }

      // Switch to completion mode
      setMode(AISelectorMode.COMPLETION);
      
      // Clear the input field to ensure options show in post-completion menu
      setInputValue("");
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
      setAction(AI_ACTIONS.DEFAULT_COMPLETION);

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

  // Add a debug button to check the message history
  // We can remove this later once everything is working
  const debugMessageHistory = () => {
    console.log("Current message history:", messageHistory);
    console.log("Current completion:", completion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Restore and improve this block to auto-insert on empty Enter when in completion mode
    if (e.key === 'Enter' && !inputValue.trim() && 
        ((hasCompletion && mode === AISelectorMode.COMPLETION) || 
         (showThreadgirlResult && threadgirlResult && mode === AISelectorMode.COMPLETION))) {
      e.preventDefault();
      // Call insertBelow function directly
      if (editor) {
        const selection = editor.view.state.selection;
        editor
          .chain()
          .focus()
          .insertContentAt(selection.to + 1, showThreadgirlResult && threadgirlResult ? threadgirlResult : completion)
          .run();
        
        // Close the AI selector completely
        onOpenChange(false);
      }
      return;
    }
    
    // Handle Enter keypress based on current mode
    if (e.key === 'Enter') {
      // Check if there's a selected item in the command menu
      const selectedElement = commandRef.current?.querySelector('[data-selected="true"]') as HTMLElement;
      
      // If there's a selected item, let Command handle it without preventDefault
      if (selectedElement) {
        // Let the Command component handle the selection
        return;
      }
      
      // No menu item is selected, so handle the Enter keypress ourselves
      e.preventDefault();
      
      // Route the Enter keypress to the appropriate handler based on mode
      if (mode === AISelectorMode.IMAGE_GENERATION) {
        // For image generation, handle generation in the ImageGeneratorMenu component
        // This will be triggered through a callback
        return;
      } else if (mode === AISelectorMode.THREADGIRL) {
        // For threadgirl, handle in the ThreadgirlMenu component
        // This will be triggered through a callback
        return;
      } else if (inputValue.trim()) {
        // For the default mode with input, run the standard prompt
        handleComplete();
      }
    }

    // Discard completion or close the modal when backspace is pressed on empty input
    if (e.key === 'Backspace' && !inputValue) {
      e.preventDefault();
      
      if (mode === AISelectorMode.THREADGIRL) {
        // If in Threadgirl submenu, go back to main menu instead of closing
        console.log('[AI-SELECTOR] Going back to main menu from Threadgirl submenu');
        setMode(AISelectorMode.DEFAULT);
      } else if (hasCompletion || (showThreadgirlResult && threadgirlResult)) {
        console.log('[AI-SELECTOR] Discarding completion or threadgirl result on empty backspace');
        // Discard the completion and clean up
        if (editor) {
          editor.chain().unsetHighlight().focus().run();
        }
        // Reset the message history or handle any other cleanup
        setMessageHistory([]);
        setShowCompletion(false);
        setShowThreadgirlResult(false);
        setThreadgirlResult(null);
        onOpenChange(false);
      } else {
        console.log('[AI-SELECTOR] Closing on empty backspace');
        onOpenChange(false);
      }
    }
  };

  // Handle command selection including the new image generation option
  const handleCommandSelect = async (value: string, option: string, promptName?: string) => {
    console.log(`[AI-SELECTOR] handleCommandSelect called with option: ${option}`);
    
    if (option === "generate-image") {
      setMode(AISelectorMode.IMAGE_GENERATION);
      setInputValue("");
    } else if (option === "get-threadgirl-prompts") {
      console.log("[AI-SELECTOR] Switching to THREADGIRL mode");
      setMode(AISelectorMode.THREADGIRL);
      setInputValue("");
      // Reset threadgirl result when switching to prompt selection
      setThreadgirlResult(null);
      setShowThreadgirlResult(false);
    } else if (option === "threadgirl") {
      console.log("[AI-SELECTOR] Processing Threadgirl result:", value.substring(0, 50) + "...");
      console.log(`[AI-SELECTOR] Current isLoadingThreadgirl state: ${isLoadingThreadgirl}`);
      
      // Add user message to history
      const newUserMessage = { role: "user", content: value };
      setMessageHistory(prev => [...prev, newUserMessage]);
      
      // Add the result to message history
      setMessageHistory(prev => [
        ...prev,
        { role: "assistant", content: value }
      ]);
      
      // Store the result in the dedicated Threadgirl state
      setThreadgirlResult(value);
      setShowThreadgirlResult(true);
      
      // Switch to completion view mode
      setMode(AISelectorMode.COMPLETION);
      
      console.log("[AI-SELECTOR] Using Threadgirl result directly");
      
      // Clear input
      setInputValue("");
      
      // Set the lastPrompt for persistence
      setLastPrompt(promptName || "Threadgirl");
      
      // Important: Reset the loading state here after we've processed the result
      console.log("[AI-SELECTOR] Setting isLoadingThreadgirl to FALSE");
      setIsLoadingThreadgirl(false);
      // Also reset the loading operation
      console.log("[AI-SELECTOR] Clearing loadingOperation state");
      setLoadingOperation(null);
    } else if (option === "set_input") {
      // Just set the input value
      setInputValue(value);
    } else if (hasSelection(editor) && ["explain", "improve", "fix", "shorten", "lengthen", "professional", "casual", "simplify"].includes(option)) {
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
      setAction(AI_ACTIONS.TRANSFORM_SELECTION);

      console.log("Auto-submitting selection with command:", {
        prompt: selectedText,
        option: option,
        command: value,
        messageHistory: [...messageHistory, newUserMessage],
        action: AI_ACTIONS.TRANSFORM_SELECTION
      });

      // Send to AI - use the formattedPrompt as the main prompt
      complete(formattedPrompt, {
        body: {
          prompt: selectedText,  // Original text for reference
          option: option,
          command: value,
          action: AI_ACTIONS.TRANSFORM_SELECTION,
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

  // Add a useEffect to handle the ignore_completion action
  useEffect(() => {
    if (action === AI_ACTIONS.IGNORE_COMPLETION) {
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
      setAction(AI_ACTIONS.DEFAULT_COMPLETION);
    }
    
    // When loading finishes and we have a completion but no specific action
    if (!isLoading && completion.length > 0 && !action) {
      setAction(AI_ACTIONS.DEFAULT_COMPLETION);
    }
  }, [isLoading, completion, action]);

  useEffect(() => {
    // When loading finishes and we have a completion, show it
    if (!isLoading && completion.length > 0) {
      setShowCompletion(true);
      setMode(AISelectorMode.COMPLETION);
      
      // Clear the input field when showing completion
      setInputValue("");
    }
  }, [isLoading, completion]);

  // Handle the transform_selection action when loading completes
  useEffect(() => {
    if (!isLoading && action === AI_ACTIONS.TRANSFORM_SELECTION && completion) {
      replaceSelection();
    }
  }, [isLoading, action, completion]);

  // Add a useEffect to debug loading state changes
  useEffect(() => {
    console.log(`[AI-SELECTOR] isLoadingThreadgirl changed to: ${isLoadingThreadgirl}`);
  }, [isLoadingThreadgirl]);

  // Add a useEffect to debug loadingOperation changes
  useEffect(() => {
    console.log(`[AI-SELECTOR] loadingOperation changed to: ${loadingOperation}`);
  }, [loadingOperation]);

  return (
    <Command
      ref={commandRef}
      className={`w-[350px] ai-selector ${isFloating ? 'in-floating-container' : ''}`}
    >
      <CommandList>
        {/* Threadgirl result view */}
        {showThreadgirlResult && threadgirlResult && mode === AISelectorMode.COMPLETION && (
          <div className="flex max-h-[900px]">
            <ScrollArea>
              <div className="prose p-2 px-4 prose-sm">
                <Markdown>{threadgirlResult}</Markdown>
              </div>
            </ScrollArea>
          </div>
        )}
        
        {/* Standard Completion view - only show if not showing Threadgirl results */}
        {hasCompletion && showCompletion && mode === AISelectorMode.COMPLETION && !showThreadgirlResult && (
          <div className="flex max-h-[900px]">
            <ScrollArea>
              <div className="prose p-2 px-4 prose-sm">
                <Markdown>{completion}</Markdown>
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Debug button - can be removed after debugging */}
        <button
          onClick={debugMessageHistory}
          className="hidden text-xs text-gray-500 hover:text-gray-700"
        >
          Debug History
        </button>

        {/* Loading indicator */}
        {(isLoading || isGeneratingImage || isLoadingThreadgirl) && (
          <div className={`flex w-full items-center px-4 text-sm font-medium ${
            isLoadingThreadgirl 
              ? 'h-16 justify-center py-4 text-purple-500 bg-purple-50 border-t mt-2' 
              : 'h-12 text-muted-foreground'
          }`}>
            <Magic className="mr-2 h-4 w-4 shrink-0" />
            <span className={isLoadingThreadgirl ? "font-semibold" : ""}>
              {mode === AISelectorMode.IMAGE_GENERATION 
                ? "Generating image..." 
                : isLoadingThreadgirl 
                  ? loadingOperation === 'loading_prompts'
                    ? "Loading Threadgirl prompts..."
                    : "Running Threadgirl prompt..." 
                  : "AI is thinking..."}
            </span>
            <div className="ml-2 mt-1">
              <CrazySpinner />
            </div>
          </div>
        )}

        {!isLoading && !isGeneratingImage && !isLoadingThreadgirl && (
          <>
            {/* Input field - always shown except in some specific modes */}
            <div className="relative">
              <CommandInput
                ref={inputRef}
                value={inputValue}
                onValueChange={setInputValue}
                autoFocus
                placeholder={
                  mode === AISelectorMode.THREADGIRL
                    ? "Search prompts or enter custom prompt..."
                    : mode === AISelectorMode.IMAGE_GENERATION 
                      ? generatedImageUrl 
                        ? "Press Enter to insert image, or describe new image..." 
                        : "Describe the image you want to generate..." 
                      : showThreadgirlResult || hasCompletion 
                        ? "Tell AI what to do next" 
                        : editor?.state.selection.content().size > 0
                          ? "Ask AI to edit or improve..."
                          : "Ask AI anything..."
                }
                onFocus={() => {
                  // Only add AI highlight for direct AI button clicks, not slash or space commands
                  if (!fromSlashCommand && !isFloating && mode === AISelectorMode.DEFAULT) {
                    addAIHighlight(editor);
                  }
                }}
                onClick={(e: React.MouseEvent) => {
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
                  mode === AISelectorMode.IMAGE_GENERATION 
                    ? () => {} // Handled by ImageGeneratorMenu
                    : mode === AISelectorMode.THREADGIRL 
                      ? () => {} // Handled by ThreadgirlMenu
                      : handleComplete
                }
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Different menu views based on mode */}
            {mode === AISelectorMode.IMAGE_GENERATION ? (
              <ImageGeneratorMenu
                onSelect={handleCommandSelect}
                onBack={() => setMode(AISelectorMode.DEFAULT)}
                inputValue={inputValue}
                setInputValue={setInputValue}
                editor={editor}
                onImageGenerated={(url: string | null) => setGeneratedImageUrl(url)}
                generatedImageUrl={generatedImageUrl}
              />
            ) : mode === AISelectorMode.THREADGIRL ? (
              <ThreadgirlMenu
                onSelect={handleCommandSelect}
                onBack={() => setMode(AISelectorMode.DEFAULT)}
                selectionContent={selectionContent}
                inputValue={inputValue}
                editor={editor}
                isLoadingThreadgirl={isLoadingThreadgirl}
                setIsLoadingThreadgirl={setIsLoadingThreadgirl}
                loadingOperation={loadingOperation}
                setLoadingOperation={setLoadingOperation}
              />
            ) : ((hasCompletion && showCompletion) || (showThreadgirlResult && threadgirlResult)) && mode === AISelectorMode.COMPLETION ? (
              // Show post-completion commands for both regular completions and threadgirl results
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
                  setShowThreadgirlResult(false);
                  
                  // Reset to default mode
                  setMode(AISelectorMode.DEFAULT);
                }}
                onClose={() => {
                  // Completely close the selector
                  if (editor) {
                    editor.chain().unsetHighlight().focus().run();
                  }
                  onOpenChange(false);
                }}
                completion={showThreadgirlResult && threadgirlResult ? threadgirlResult : completion}
                handleRunThreadgirlPrompt={() => setMode(AISelectorMode.THREADGIRL)}
                originalPrompt={lastPrompt}
              />
            ) : (
              // Default AI selector commands
              <AISelectorCommands
                onSelect={handleCommandSelect}
                hasSelection={Boolean(editor?.state.selection.content().size > 0 || selectionContent?.trim().length > 0)}
                threadgirlPrompts={threadgirlPrompts}
                showThreadgirlMenu={mode === AISelectorMode.THREADGIRL}
                onBackFromThreadgirl={() => setMode(AISelectorMode.DEFAULT)}
                isLoadingThreadgirlPrompts={isLoadingThreadgirlPrompts}
              />
            )}
          </>
        )}

        <CommandEmpty>
          {mode === AISelectorMode.THREADGIRL 
            ? "Press Enter to run Threadgirl prompt"
            : mode === AISelectorMode.IMAGE_GENERATION 
                ? generatedImageUrl
                  ? "Press Enter to insert image"
                  : "Press Enter to generate image" 
                : (showThreadgirlResult || hasCompletion) && mode === AISelectorMode.COMPLETION
                    ? "Press Enter to insert below"
                    : "Press Enter to send message"}
        </CommandEmpty>
      </CommandList>
    </Command>
  );
}
