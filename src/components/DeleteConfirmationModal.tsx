import { useStore } from '@nanostores/react';
import { deleteModalState, closeDeleteModal } from '../lib/stores';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

export function DeleteConfirmationModal() {
  const modalState = useStore(deleteModalState);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && modalState.isOpen) {
      modalState.onConfirm();
    }
  };
  
  return (
    <Dialog open={modalState.isOpen} onOpenChange={(open) => {
      if (!open) closeDeleteModal();
    }}>
      <DialogContent 
        className="sm:max-w-[425px]" 
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{modalState.projectName}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={closeDeleteModal}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={modalState.onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 