import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  /** Kept open (with a spinner) until the returned promise settles. */
  onConfirm: () => Promise<void> | void;
  destructive?: boolean;
}

/** Accessible confirmation dialog (focus-trapped, Esc to cancel), replacing window.confirm. */
const ConfirmDialog = ({ open, onOpenChange, title, description, confirmLabel, onConfirm, destructive = false }: ConfirmDialogProps) => {
  const [isPending, setIsPending] = useState(false);

  const confirm = async (event: React.MouseEvent) => {
    event.preventDefault(); // keep the dialog open while the action runs
    setIsPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant={destructive ? "destructive" : "default"} onClick={confirm} disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              {confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmDialog;
