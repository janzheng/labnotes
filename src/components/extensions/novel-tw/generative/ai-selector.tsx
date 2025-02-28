"use client";

import { Command, CommandInput, CommandList, CommandEmpty } from "@/components/ui/command";

import { useCompletion } from "@ai-sdk/react";
import { ArrowUp, ImageIcon } from "lucide-react";
import { useEditor } from "@/components/extensions/novel-src";
import { addAIHighlight } from "@/components/extensions/novel-src";
import { useState, useRef, useEffect } from "react";
import Markdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "../ui/button";
import CrazySpinner from "../ui/icons/crazy-spinner";
import Magic from "../ui/icons/magic";
import { ScrollArea } from "../ui/scroll-area";
import AICompletionCommands from "./ai-completion-command";
import AISelectorCommands from "./ai-selector-commands";
import { actions } from 'astro:actions';
//TODO: I think it makes more sense to create a custom Tiptap extension for this functionality https://tiptap.dev/docs/editor/ai/introduction

interface AISelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromSlashCommand?: boolean;
  isFloating?: boolean;
}

interface ThreadgirlPrompt {
  _id: number;
  date: string;
  hash: string;
  name: string;
  prompt: string;
}

export function AISelector({ open, onOpenChange, fromSlashCommand = false, isFloating = false }: AISelectorProps) {
  const { editor } = useEditor();
  const [inputValue, setInputValue] = useState("");
  const [messageHistory, setMessageHistory] = useState<Array<{role: string, content: string}>>([]);
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
  const [threadgirlPrompts, setThreadgirlPrompts] = useState<ThreadgirlPrompt[] | null>(null);
  const [isLoadingThreadgirlPrompts, setIsLoadingThreadgirlPrompts] = useState(false);
  const [showThreadgirlMenu, setShowThreadgirlMenu] = useState(false);
  const [isLoadingThreadgirl, setIsLoadingThreadgirl] = useState(false);

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
      
      // For selection-based transformations, replace the selected text
      if (action === "transform_selection") {
        // The useEffect will handle the replacement when isLoading becomes false
      }
    },
  });

  // Track the current action being performed
  const [action, setAction] = useState<string | null>(null);

  const hasCompletion = completion.length > 0;

  const handleComplete = async () => {
    try {
      // Get selected text if any
      const slice = editor.state.selection.content();
      const selectedText = editor.storage.markdown.serializer.serialize(slice.content);
      
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
    if (e.key === 'Enter') {
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
      
      // If we're in the threadgirl menu and a prompt is selected
      if (showThreadgirlMenu && threadgirlPrompts) {
        // Find if there's a selected prompt that matches the input
        const selectedPrompt = threadgirlPrompts.find(p => p.name.toLowerCase() === inputValue.toLowerCase());
        
        if (selectedPrompt) {
          // If there's a matching prompt, run it
          e.preventDefault();
          handleRunThreadgirlPrompt(selectedPrompt.name);
          return;
        } else if (inputValue.trim() === '') {
          // If input is empty, check if there's a selected item in the UI
          const selectedElement = commandRef.current?.querySelector('[data-selected="true"]') as HTMLElement;
          if (selectedElement) {
            const promptName = selectedElement.textContent?.trim();
            if (promptName) {
              e.preventDefault();
              const prompt = threadgirlPrompts.find(p => p.name === promptName);
              if (prompt) {
                handleRunThreadgirlPrompt(prompt.name);
                return;
              }
            }
          }
        }
      }
      
      // Otherwise, handle as a direct message
      if (inputValue.trim()) {
        e.preventDefault();
        if (isImageMode) {
          handleGenerateImage();
        } else if (showThreadgirlMenu) {
          // If in threadgirl menu with input but no matching prompt, run with custom input
          handleRunThreadgirlPrompt();
        } else {
          handleComplete();
        }
      }
    }
    
    // Close the modal when backspace is pressed on empty input
    if (e.key === 'Backspace' && !inputValue) {
      e.preventDefault();
      if (showThreadgirlMenu) {
        // If in threadgirl menu, go back to main menu
        setShowThreadgirlMenu(false);
      } else {
        console.log('[AI-SELECTOR] Closing on empty backspace');
        onOpenChange(false);
      }
    }
  };

  // Add a helper function to run threadgirl prompts
  const handleRunThreadgirlPrompt = async (promptName?: string) => {
    try {
      setIsLoadingThreadgirl(true);
      
      // Get selected text if any
      const slice = editor.state.selection.content();
      const selectedText = editor.storage.markdown.serializer.serialize(slice.content);
      
      // Format the query with prompt name in curly braces and any selected text
      let formattedQuery = "";
      
      // Add the prompt name in curly braces if provided
      if (promptName) {
        formattedQuery += `{${promptName}}`;
      }
      
      // Add any user input from the input field
      if (inputValue.trim()) {
        // If we already have a prompt name, add a space before the input
        if (formattedQuery) {
          formattedQuery += " ";
        }
        formattedQuery += inputValue.trim();
      }
      
      // Add any selected text
      if (selectedText.trim()) {
        // If we already have content, add a space before the selected text
        if (formattedQuery) {
          formattedQuery += " ";
        }
        formattedQuery += selectedText.trim();
      }
      
      // If we have no query at all, show an error
      if (!formattedQuery.trim()) {
        toast.error("Please select a prompt or enter some text");
        setIsLoadingThreadgirl(false);
        return;
      }
      
      const { data, error } = await actions.canvas.threadgirl({
        command: 'runThreadgirl',
        sources: [],
        prompts: [],
        query: formattedQuery,
        url: '',
        useCache: true,
        saveCache: true,
      });

      if (error) throw error;
      
      // Handle the response as needed
      if (data.result) {
        console.log("Threadgirl result:", data.result);
        
        // Convert the result to a string if it's an array
        let resultText = "";
        if (Array.isArray(data.result)) {
          resultText = data.result.join("\n\n");
        } else {
          resultText = data.result.toString();
        }
        
        // Add the result to the message history
        setMessageHistory(prev => [
          ...prev,
          { role: "assistant", content: resultText }
        ]);
        
        // Insert the result into the editor
        if (editor) {
          // Get the current selection
          const { from, to } = editor.state.selection;
          
          // Find the end of the current paragraph
          const resolvedPos = editor.state.doc.resolve(from);
          const endOfParagraph = resolvedPos.end();
          
          // Insert the completion at the end of the paragraph
          editor.chain()
            .focus()
            .insertContentAt(endOfParagraph, `\n\n${resultText}`)
            .run();
            
          // Close the selector after inserting
          onOpenChange(false);
        }
      }
      
      setIsLoadingThreadgirl(false);
    } catch (error) {
      console.error("Error running threadgirl prompt:", error);
      toast.error("Failed to run threadgirl prompt");
      setIsLoadingThreadgirl(false);
    }
  };

  // Handle command selection including the new image generation option
  const handleCommandSelect = async (value: string, option: string, promptName?: string) => {
    if (option === "generate-image") {
      setIsImageMode(true);
      setInputValue("");
    } else if (option === "get-threadgirl-prompts") {
      await handleGetThreadgirlPrompts();
      setShowThreadgirlMenu(true);
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
      const slice = editor.state.selection.content();
      const selectedText = editor.storage.markdown.serializer.serialize(slice.content);
      
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

  // In the AISelector component, modify the useEffect that handles completion
  useEffect(() => {
    // Only auto-insert if there's no actual selection AND it's not from a slash command or keyboard shortcut
    if (completion.length > 0 && !fromSlashCommand) {
      const selection = editor.view.state.selection;
      // Check if this is a cursor position rather than a selection
      if (selection.from === selection.to) {
        insertBelow();
      }
    }
  }, [completion]);

  // Function to insert text at cursor position
  const insertAtCursor = (text: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(text).run();
  };

  // Function to insert text below current paragraph
  const insertBelow = () => {
    if (!editor) return;
    
    // Get the current selection
    const { from, to } = editor.state.selection;
    
    // Find the end of the current paragraph
    const resolvedPos = editor.state.doc.resolve(from);
    const endOfParagraph = resolvedPos.end();
    
    // Insert the completion at the end of the paragraph
    editor.chain()
      .focus()
      .insertContentAt(endOfParagraph, `\n\n${completion}`)
      .run();
      
    // Close the selector after inserting
    onOpenChange(false);
  };

  // Function to replace selected text
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

  // Handle completion for selection transformations
  useEffect(() => {
    if (action === "transform_selection" && completion && !isLoading) {
      // Replace the selected text with the completion
      replaceSelection();
      
      // Reset the action
      setAction(null);
    }
  }, [isLoading, action, completion]);

  // Modify the function to handle getting prompts using the existing threadgirlAction
  const handleGetThreadgirlPrompts = async () => {
    try {
      setIsLoadingThreadgirlPrompts(true);
      
      console.log("Getting available threadgirl prompts");
      
      const { data, error } = await actions.canvas.threadgirl({
        command: 'getThreadgirlPrompts',
        sources: [],
        prompts: [],
        query: '',
        url: '',
        useCache: true,
        saveCache: true,
      });
      
      if (error) {
        console.error("Error getting threadgirl prompts:", error);
        throw new Error("Failed to get threadgirl prompts");
      }
      
      setThreadgirlPrompts(data.prompts);
      setIsLoadingThreadgirlPrompts(false);
      toast.success("Threadgirl prompts retrieved successfully!");
      
    } catch (error) {
      console.error("Error getting threadgirl prompts:", error);
      setIsLoadingThreadgirlPrompts(false);
      toast.error("Failed to get threadgirl prompts");
    }
  };

  return (
    <Command 
      ref={commandRef}
      className={`w-[350px] ai-selector ${isFloating ? 'in-floating-container' : ''}`}
    >
      <CommandList>
        {hasCompletion && !isImageMode && (
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
        
        {!isLoading && !isGeneratingImage && (
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
                onKeyDown={handleKeyDown}
              />
              <Button
                size="icon"
                className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-purple-500 hover:bg-purple-900"
                onClick={isImageMode ? handleGenerateImage : handleComplete}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
            
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
              threadgirlPrompts={threadgirlPrompts}
              showThreadgirlMenu={showThreadgirlMenu}
              onBackFromThreadgirl={() => setShowThreadgirlMenu(false)}
              isLoadingThreadgirlPrompts={isLoadingThreadgirlPrompts}
            />
          </>
        )}
      
        <CommandEmpty>
          {showThreadgirlMenu 
            ? "No matching prompts found"
            : `Press Enter to ${isImageMode ? "generate image" : "send message"}`}
        </CommandEmpty>
      </CommandList>
    </Command>
  );
}
