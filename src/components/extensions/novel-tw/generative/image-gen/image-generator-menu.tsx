import React from "react";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import { ImageIcon, RefreshCcwDot, StepForward, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { actions } from 'astro:actions';

interface ImageGeneratorMenuProps {
  onSelect: (value: string, option: string) => void;
  onBack: () => void;
  inputValue: string;
  setInputValue: (value: string) => void;
  editor?: any;
  onImageGenerated?: (url: string | null) => void;
  generatedImageUrl?: string | null;
}

const ImageGeneratorMenu: React.FC<ImageGeneratorMenuProps> = ({
  onSelect,
  onBack,
  inputValue,
  setInputValue,
  editor,
  onImageGenerated,
  generatedImageUrl: propGeneratedImageUrl
}) => {
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(propGeneratedImageUrl || null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState<string>("");

  // Sync state with props if the prop changes
  useEffect(() => {
    if (propGeneratedImageUrl !== undefined) {
      setGeneratedImageUrl(propGeneratedImageUrl);
    }
  }, [propGeneratedImageUrl]);

  // Notify parent when our image URL changes
  useEffect(() => {
    if (onImageGenerated && generatedImageUrl !== propGeneratedImageUrl) {
      onImageGenerated(generatedImageUrl);
    }
  }, [generatedImageUrl, onImageGenerated, propGeneratedImageUrl]);

  // Handler for keypresses in the parent component
  useEffect(() => {
    // Listen for Enter key event in the parent component's input field
    const handleKeyDown = (e: KeyboardEvent) => {
      // Case 1: Empty input + generated image = insert image
      if (e.key === 'Enter' && !inputValue.trim() && generatedImageUrl) {
        e.preventDefault();
        e.stopPropagation();
        insertGeneratedImage();
        return;
      }
      
      // Case 2: Non-empty input + no current generation = generate image
      if (e.key === 'Enter' && inputValue.trim() && !isGeneratingImage) {
        e.preventDefault();
        e.stopPropagation();
        handleGenerateImage();
      }
    };

    // Add global event listener since our input is managed by parent
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [inputValue, isGeneratingImage, generatedImageUrl]);

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

  const resetImageGeneration = () => {
    setGeneratedImageUrl(null);
    setInputValue("");
    setImagePrompt("");
    if (onImageGenerated) {
      onImageGenerated(null);
    }
    onBack();
  };

  const insertGeneratedImage = () => {
    if (!editor || !generatedImageUrl) return;
    
    editor.chain().focus().insertContent(`![Generated Image](${generatedImageUrl})`).run();
    onBack();
  };

  return (
    <div>
      {generatedImageUrl ? (
        <>
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
          
          <CommandGroup heading="Image Actions">
            <CommandItem
              onSelect={insertGeneratedImage}
              className="flex items-center"
            >
              <StepForward className="mr-2 h-4 w-4" />
              <span>Insert image into document</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleGenerateImage()}
              className="flex items-center"
            >
              <RefreshCcwDot className="mr-2 h-4 w-4" />
              <span>Generate another image</span>
            </CommandItem>
            <CommandItem
              onSelect={resetImageGeneration}
              className="flex items-center"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span>Back to main menu</span>
            </CommandItem>
          </CommandGroup>
        </>
      ) : (
        <>
          <div className="p-2">
            <div className="text-sm mb-2">Enter a description for the image you want to generate:</div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={handleGenerateImage}
              disabled={!inputValue.trim() || isGeneratingImage}
            >
              {isGeneratingImage ? "Generating..." : "Generate Image"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2"
              onClick={onBack}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default ImageGeneratorMenu; 