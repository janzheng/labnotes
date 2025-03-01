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
  const [threadgirlResult, setThreadgirlResult] = useState<string | null>(null);
  const [showThreadgirlResult, setShowThreadgirlResult] = useState(false);
  const [loadingOperation, setLoadingOperation] = useState<string | null>(null);
  const [scrollAreaMaxHeight, setScrollAreaMaxHeight] = useState<string>("30vh");
  const containerRef = useRef<HTMLDivElement>(null);

  // Add these new state variables for height management
  const [aiSelectorMaxHeight, setAiSelectorMaxHeight] = useState<string>("70vh");
  const [commandListMaxHeight, setCommandListMaxHeight] = useState<string>("calc(70vh - 60px)");

  useEffect(() => {
    if (open) {
      console.log('[AI-SELECTOR] Opened with fromSlashCommand:', fromSlashCommand, 'isFloating:', isFloating);
    }
  }, [open, fromSlashCommand, isFloating]);

  useEffect(() => {
    if (!open) return;

    const focusInput = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    focusInput();

    const immediateTimeout = setTimeout(focusInput, 10);
    const shortTimeout = setTimeout(focusInput, 50);
    const mediumTimeout = setTimeout(focusInput, 100);

    const interval = setInterval(() => {
      if (document.activeElement !== inputRef.current) {
        focusInput();
      }
    }, 50);

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

      setMessageHistory(prev => [
        ...prev,
        { role: "assistant", content: result }
      ]);

      if (!action) {
        setAction(AI_ACTIONS.DEFAULT_COMPLETION);
      }

      setMode(AISelectorMode.COMPLETION);
      
      setInputValue("");
    },
  });

  const [action, setAction] = useState<string | null>(null);

  const hasCompletion = completion.length > 0;

  const handleComplete = async () => {
    try {
      let selectedText = selectionContent;
      
      if (!selectedText && editor) {
        const slice = editor.state.selection.content();
        selectedText = editor.storage.markdown.serializer.serialize(slice.content);
      }

      let textToSend = '';
      const hasSelection = selectedText.trim().length > 0;
      const hasInput = inputValue.trim().length > 0;

      if (hasSelection && hasInput) {
        textToSend = `<instruction>${inputValue.trim()}</instruction>\n\n${selectedText.trim()}`;
      } else if (hasSelection) {
        textToSend = selectedText.trim();
      } else if (hasInput) {
        textToSend = inputValue.trim();
      } else {
        toast.error("Please enter a message or select text");
        return;
      }

      const newUserMessage = { role: "user", content: textToSend };
      setMessageHistory(prev => [...prev, newUserMessage]);

      console.log("Sending to AI:", {
        prompt: textToSend,
        option: "zap",
        command: inputValue,
        messageHistory: [...messageHistory, newUserMessage]
      });

      setLastPrompt(inputValue);

      setAction(AI_ACTIONS.DEFAULT_COMPLETION);

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

  const debugMessageHistory = () => {
    console.log("Current message history:", messageHistory);
    console.log("Current completion:", completion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !inputValue.trim() && 
        ((hasCompletion && mode === AISelectorMode.COMPLETION) || 
         (showThreadgirlResult && threadgirlResult && mode === AISelectorMode.COMPLETION))) {
      e.preventDefault();
      if (editor) {
        const selection = editor.view.state.selection;
        editor
          .chain()
          .focus()
          .insertContentAt(selection.to + 1, showThreadgirlResult && threadgirlResult ? threadgirlResult : completion)
          .run();
        
        onOpenChange(false);
      }
      return;
    }
    
    if (e.key === 'Enter') {
      const selectedElement = commandRef.current?.querySelector('[data-selected="true"]') as HTMLElement;
      
      if (selectedElement) {
        return;
      }
      
      e.preventDefault();
      
      if (mode === AISelectorMode.IMAGE_GENERATION) {
        return;
      } else if (mode === AISelectorMode.THREADGIRL) {
        return;
      } else if (inputValue.trim()) {
        handleComplete();
      }
    }

    if (e.key === 'Backspace' && !inputValue) {
      e.preventDefault();
      
      if (mode === AISelectorMode.THREADGIRL) {
        console.log('[AI-SELECTOR] Going back to main menu from Threadgirl submenu');
        setMode(AISelectorMode.DEFAULT);
      } else if (hasCompletion || (showThreadgirlResult && threadgirlResult)) {
        console.log('[AI-SELECTOR] Discarding completion or threadgirl result on empty backspace');
        if (editor) {
          editor.chain().unsetHighlight().focus().run();
        }
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

  const handleCommandSelect = async (value: string, option: string, promptName?: string) => {
    console.log(`[AI-SELECTOR] handleCommandSelect called with option: ${option}`);
    
    if (option === "generate-image") {
      setMode(AISelectorMode.IMAGE_GENERATION);
      setInputValue("");
    } else if (option === "get-threadgirl-prompts") {
      console.log("[AI-SELECTOR] Switching to THREADGIRL mode");
      setMode(AISelectorMode.THREADGIRL);
      setInputValue("");
      setThreadgirlResult(null);
      setShowThreadgirlResult(false);
    } else if (option === "threadgirl") {
      console.log("[AI-SELECTOR] Processing Threadgirl result:", value.substring(0, 50) + "...");
      console.log(`[AI-SELECTOR] Current isLoadingThreadgirl state: ${isLoadingThreadgirl}`);
      
      const newUserMessage = { role: "user", content: value };
      setMessageHistory(prev => [...prev, newUserMessage]);
      
      setMessageHistory(prev => [
        ...prev,
        { role: "assistant", content: value }
      ]);
      
      setThreadgirlResult(value);
      setShowThreadgirlResult(true);
      
      setMode(AISelectorMode.COMPLETION);
      
      console.log("[AI-SELECTOR] Using Threadgirl result directly");
      
      setInputValue("");
      
      setLastPrompt(promptName || "Threadgirl");
      
      console.log("[AI-SELECTOR] Setting isLoadingThreadgirl to FALSE");
      setIsLoadingThreadgirl(false);
      console.log("[AI-SELECTOR] Clearing loadingOperation state");
      setLoadingOperation(null);
    } else if (option === "set_input") {
      setInputValue(value);
    } else if (hasSelection(editor) && ["explain", "improve", "fix", "shorten", "lengthen", "professional", "casual", "simplify"].includes(option)) {
      let selectedText = selectionContent;
      
      if (!selectedText && editor) {
        const slice = editor.state.selection.content();
        selectedText = editor.storage.markdown.serializer.serialize(slice.content);
      }

      if (!selectedText.trim()) {
        toast.error("No text selected to transform");
        return;
      }

      const formattedPrompt = `<instruction>${value}</instruction>\n\n${selectedText.trim()}`;

      const newUserMessage = { role: "user", content: formattedPrompt };
      setMessageHistory(prev => [...prev, newUserMessage]);

      setAction(AI_ACTIONS.TRANSFORM_SELECTION);

      console.log("Auto-submitting selection with command:", {
        prompt: selectedText,
        option: option,
        command: value,
        messageHistory: [...messageHistory, newUserMessage],
        action: AI_ACTIONS.TRANSFORM_SELECTION
      });

      complete(formattedPrompt, {
        body: {
          prompt: selectedText,
          option: option,
          command: value,
          action: AI_ACTIONS.TRANSFORM_SELECTION,
          messageHistory: [...messageHistory, newUserMessage]
        },
      });

    } else {
      setAction(null);
      complete(value, { body: { option } });
    }
  };

  const hasSelection = (editor: any) => {
    if (selectionContent && selectionContent.trim().length > 0) return true;
    if (!editor) return false;
    const selection = editor.state.selection;
    return selection.from !== selection.to;
  };

  const replaceSelection = () => {
    if (!editor) return;

    const { from, to } = editor.state.selection;

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

    onOpenChange(false);
  };

  useEffect(() => {
    if (action === AI_ACTIONS.IGNORE_COMPLETION) {
      setAction(null);
    }
  }, [action]);

  useEffect(() => {
    if (isLoading && !action) {
      setAction(AI_ACTIONS.DEFAULT_COMPLETION);
    }
    
    if (!isLoading && completion.length > 0 && !action) {
      setAction(AI_ACTIONS.DEFAULT_COMPLETION);
    }
  }, [isLoading, completion, action]);

  useEffect(() => {
    if (!isLoading && completion.length > 0) {
      setShowCompletion(true);
      setMode(AISelectorMode.COMPLETION);
      
      setInputValue("");
    }
  }, [isLoading, completion]);

  useEffect(() => {
    if (!isLoading && action === AI_ACTIONS.TRANSFORM_SELECTION && completion) {
      replaceSelection();
    }
  }, [isLoading, action, completion]);

  useEffect(() => {
    console.log(`[AI-SELECTOR] isLoadingThreadgirl changed to: ${isLoadingThreadgirl}`);
  }, [isLoadingThreadgirl]);

  useEffect(() => {
    console.log(`[AI-SELECTOR] loadingOperation changed to: ${loadingOperation}`);
  }, [loadingOperation]);

  // Calculate appropriate heights when component mounts or position changes
  useEffect(() => {
    if (!open) return;
    
    const calculateOptimalHeights = () => {
      // Get viewport dimensions
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      // Default padding to give some space at viewport edges
      const edgePadding = 40;
      
      // Get AI selector position if available
      let positionInfo = {
        top: 0,
        bottom: viewportHeight,
        height: 0
      };
      
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        positionInfo = {
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height
        };
      }
      
      // Calculate available space above and below
      const spaceAbove = Math.max(0, positionInfo.top - edgePadding);
      const spaceBelow = Math.max(0, viewportHeight - positionInfo.top - edgePadding);
      
      // Determine if we have more space above or below
      const moreSpaceBelow = spaceBelow >= spaceAbove;
      
      // Calculate max heights based on available space
      // Use the larger area (above or below) for positioning
      const availableSpace = Math.max(spaceAbove, spaceBelow);
      
      // Apply constraints to avoid too large or too small selector
      let maxHeight = Math.min(
        Math.max(availableSpace, 250), // Minimum usable height
        viewportHeight * 0.7           // Maximum fraction of viewport
      );
      
      // Reserve space for command input (approximately 60px)
      const commandInputHeight = 60;
      const commandListHeight = maxHeight - commandInputHeight;
      
      // Reserve additional space for command items, loading indicators, etc.
      // Scroll areas should take up most of the remaining space but leave room for other UI
      const uiElementsHeight = 120; // Approximate height of other UI elements
      const scrollAreaHeight = commandListHeight - uiElementsHeight;
      
      // Update state with calculated heights
      setAiSelectorMaxHeight(`${maxHeight}px`);
      setCommandListMaxHeight(`${commandListHeight}px`);
      setScrollAreaMaxHeight(`${Math.max(scrollAreaHeight, 100)}px`); // Ensure minimum scrollable height
      
      console.log('AI Selector heights calculated:', {
        total: `${maxHeight}px`,
        commandList: `${commandListHeight}px`,
        scrollArea: `${scrollAreaHeight}px`
      });
    };
    
    // Calculate on mount and when window is resized
    calculateOptimalHeights();
    window.addEventListener('resize', calculateOptimalHeights);
    
    return () => window.removeEventListener('resize', calculateOptimalHeights);
  }, [open, isFloating]);

  return (
    <Command
      ref={(el) => {
        if (typeof commandRef === 'function') {
          commandRef(el);
        } else if (commandRef) {
          commandRef.current = el;
        }
        containerRef.current = el;
      }}
      className={`w-[350px] ai-selector ${isFloating ? 'in-floating-container' : ''}`}
      style={{ maxHeight: aiSelectorMaxHeight }}
    >
      <CommandList style={{ maxHeight: commandListMaxHeight, overflow: 'auto' }}>
        {showThreadgirlResult && threadgirlResult && mode === AISelectorMode.COMPLETION && (
          <div className="flex">
            <ScrollArea className="w-full" maxHeight={scrollAreaMaxHeight}>
              <div className="prose p-2 px-4 prose-sm">
                <Markdown>{threadgirlResult}</Markdown>
              </div>
            </ScrollArea>
          </div>
        )}
        
        {hasCompletion && showCompletion && mode === AISelectorMode.COMPLETION && !showThreadgirlResult && (
          <div className="flex">
            <ScrollArea className="w-full" maxHeight={scrollAreaMaxHeight}>
              <div className="prose p-2 px-4 prose-sm">
                <Markdown>{completion}</Markdown>
              </div>
            </ScrollArea>
          </div>
        )}

        <button
          onClick={debugMessageHistory}
          className="hidden text-xs text-gray-500 hover:text-gray-700"
        >
          Debug History
        </button>

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
                  if (!fromSlashCommand && !isFloating && mode === AISelectorMode.DEFAULT) {
                    addAIHighlight(editor);
                  }
                }}
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
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
                    ? () => {}
                    : mode === AISelectorMode.THREADGIRL 
                      ? () => {}
                      : handleComplete
                }
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
            
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
              <div style={{ maxHeight: commandListMaxHeight, overflow: 'auto' }}>
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
              </div>
            ) : ((hasCompletion && showCompletion) || (showThreadgirlResult && threadgirlResult)) && mode === AISelectorMode.COMPLETION ? (
              <AIPostCompletionCommands
                onDiscard={() => {
                  if (editor) {
                    editor.chain().unsetHighlight().focus().run();
                  }
                  
                  setInputValue(lastPrompt);
                  
                  setShowCompletion(false);
                  setShowThreadgirlResult(false);
                  
                  setMode(AISelectorMode.DEFAULT);
                }}
                onClose={() => {
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
