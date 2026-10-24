import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useHotkey } from "@/hooks/use-hotkey";
import { isModKey, MOD_KEY_LABEL } from "@/lib/keyboard";
import Kbd from "@/components/app/Kbd";

const MAX_HEIGHT_PX = 200;

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isBusy: boolean;
  disabled: boolean;
}

/**
 * Auto-growing prompt input.
 * Enter or ⌘/Ctrl+Enter sends, Shift+Enter adds a line, Esc stops a pending reply, "/" focuses.
 */
const ChatComposer = forwardRef<HTMLTextAreaElement, ChatComposerProps>(
  ({ value, onChange, onSubmit, onStop, isBusy, disabled }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement);

    // Grow with content up to MAX_HEIGHT_PX, then scroll
    useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
    }, [value]);

    // Autofocus once the composer becomes usable (documents often arrive after mount)
    useEffect(() => {
      if (!disabled) textareaRef.current?.focus();
    }, [disabled]);

    useHotkey({ key: "Escape" }, onStop, { enabled: isBusy });
    useHotkey({ key: "/" }, () => textareaRef.current?.focus(), { enabled: !disabled });

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === "Enter" && (isModKey(event) || !event.shiftKey)) {
        event.preventDefault();
        onSubmit();
      }
    };

    const canSend = !disabled && !isBusy && value.trim().length > 0;

    return (
      <div>
        <div className="flex items-end gap-2 rounded-xl border bg-card p-2 transition-colors focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/20">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Upload a document to start chatting" : "Ask a question about your documents…"}
            disabled={disabled}
            rows={1}
            autoFocus
            aria-label="Message"
            className="max-h-[200px] min-h-0 resize-none border-0 bg-transparent px-2 py-2 text-[0.9375rem] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {isBusy ? (
            <Button onClick={onStop} size="icon" variant="outline" className="h-9 w-9 shrink-0" aria-label="Stop response (Esc)" title="Stop (Esc)">
              <Square className="!h-3.5 !w-3.5 fill-current" />
            </Button>
          ) : (
            <Button onClick={onSubmit} disabled={!canSend} size="icon" className="h-9 w-9 shrink-0" aria-label="Send message" title={`Send (Enter or ${MOD_KEY_LABEL}+Enter)`}>
              <Send />
            </Button>
          )}
        </div>
        <p className="mt-2 hidden items-center justify-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <Kbd>Enter</Kbd> to send
          <span className="mx-1">·</span>
          <Kbd>Shift</Kbd>
          <Kbd>Enter</Kbd> new line
          <span className="mx-1">·</span>
          {isBusy ? (
            <>
              <Kbd>Esc</Kbd> to stop
            </>
          ) : (
            <>
              <Kbd>/</Kbd> to focus
            </>
          )}
        </p>
      </div>
    );
  },
);
ChatComposer.displayName = "ChatComposer";

export default ChatComposer;
