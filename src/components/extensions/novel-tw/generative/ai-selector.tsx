"use client";

import { Command, CommandInput, CommandList, CommandEmpty } from "@/components/ui/command";

import { useCompletion } from "@ai-sdk/react";
import { ArrowUp } from "lucide-react";
import { useEditor } from "@/components/extensions/novel-src";
import { addAIHighlight } from "@/components/extensions/novel-src";
import { useState } from "react";
import Markdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "../ui/button";
import CrazySpinner from "../ui/icons/crazy-spinner";
import Magic from "../ui/icons/magic";
import { ScrollArea } from "../ui/scroll-area";
import AICompletionCommands from "./ai-completion-command";
import AISelectorCommands from "./ai-selector-commands";
//TODO: I think it makes more sense to create a custom Tiptap extension for this functionality https://tiptap.dev/docs/editor/ai/introduction

interface AISelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AISelector({ onOpenChange }: AISelectorProps) {
  const { editor } = useEditor();
  const [inputValue, setInputValue] = useState("");

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
    onFinish: (result) => {
      console.log("AI Completion finished:", {
        result,
        length: result.length
      });
    },
  });

  console.log("completion", completion);
  const hasCompletion = completion.length > 0;

  const handleComplete = async () => {
    try {
      const slice = editor.state.selection.content();
      const text = editor.storage.markdown.serializer.serialize(slice.content);
      
      if (!text.trim()) {
        toast.error("Please select some text first");
        return;
      }
      
      console.log("Sending to AI:", {
        prompt: text,
        option: "zap",
        command: inputValue
      });
      
      await complete(text, {
        body: { 
          prompt: text,
          option: "zap", 
          command: inputValue 
        },
      });
      setInputValue("");
    } catch (error) {
      console.error("Error in handleComplete:", error);
      toast.error("Failed to send request to AI");
    }
  };

  return (
    <Command className="w-[350px]">
      <CommandList>
        {hasCompletion && (
          <div className="flex max-h-[400px]">
            <ScrollArea>
              <div className="prose p-2 px-4 prose-sm">
                <Markdown>{completion}</Markdown>
              </div>
            </ScrollArea>
          </div>
        )}

        {isLoading && (
          <div className="flex h-12 w-full items-center px-4 text-sm font-medium text-muted-foreground text-purple-500">
            <Magic className="mr-2 h-4 w-4 shrink-0  " />
            AI is thinking
            <div className="ml-2 mt-1">
              <CrazySpinner />
            </div>
          </div>
        )}
        
        {!isLoading && (
          <>
            <div className="relative">
              <CommandInput
                value={inputValue}
                onValueChange={setInputValue}
                autoFocus
                placeholder={hasCompletion ? "Tell AI what to do next" : "Ask AI to edit or generate..."}
                onFocus={() => addAIHighlight(editor)}
              />
              <Button
                size="icon"
                className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-purple-500 hover:bg-purple-900"
                onClick={handleComplete}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
            {hasCompletion ? (
              <AICompletionCommands
                onDiscard={() => {
                  editor.chain().unsetHighlight().focus().run();
                  onOpenChange(false);
                }}
                completion={completion}
              />
            ) : (
              <AISelectorCommands onSelect={(value, option) => complete(value, { body: { option } })} />
            )}
          </>
        )}
      
        <CommandEmpty>No results found.</CommandEmpty>
      </CommandList>
    </Command>
  );
}
