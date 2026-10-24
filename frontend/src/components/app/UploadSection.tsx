import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { File, Loader2, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAbortController } from "@/hooks/use-abort-controller";
import { formatMegabytes, useServerConfig } from "@/hooks/use-server-config";
import API_CONFIG from "@/lib/api";
import { errorText, isAbortError, uploadWithProgress } from "@/lib/http";
import IconBadge from "@/components/app/IconBadge";

interface UploadSectionProps {
  onUploadSuccess: (filename: string) => void;
}

type Phase = { name: "idle" } | { name: "uploading"; progress: number } | { name: "processing" };

const isPdf = (file: File) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

const UploadSection = ({ onUploadSuccess }: UploadSectionProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const { max_upload_size: maxSize } = useServerConfig();
  const request = useAbortController();
  const { toast } = useToast();

  const upload = async (file: File | undefined) => {
    if (!file || !isPdf(file)) {
      toast({ title: "Invalid file type", description: "Please upload a PDF file", variant: "destructive" });
      return;
    }
    if (file.size > maxSize) {
      toast({ title: "File too large", description: `Please upload a file smaller than ${formatMegabytes(maxSize)}`, variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setPhase({ name: "uploading", progress: 0 });
    try {
      await uploadWithProgress(API_CONFIG.ENDPOINTS.UPLOAD, formData, {
        signal: request.begin(),
        // Once the bytes are sent, the server still parses and embeds the PDF
        onProgress: (fraction) => setPhase(fraction < 1 ? { name: "uploading", progress: Math.round(fraction * 100) } : { name: "processing" }),
      });
      toast({ title: "Upload successful!", description: `${file.name} has been processed` });
      onUploadSuccess(file.name);
    } catch (error) {
      if (!isAbortError(error)) {
        toast({ title: "Upload failed", description: errorText(error, "Failed to upload document. Please try again."), variant: "destructive" });
      }
    } finally {
      setPhase({ name: "idle" });
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (phase.name === "idle") upload(Array.from(event.dataTransfer.files)[0]);
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    upload(event.target.files?.[0]);
    event.target.value = ""; // allow re-selecting the same file
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragging(false);
      }}
      onDrop={handleDrop}
      className={`rounded-xl border border-dashed p-5 text-center transition-colors ${
        isDragging ? "border-primary bg-primary/5" : "bg-card hover:border-foreground/25"
      }`}
    >
      <IconBadge icon={Upload} size="sm" tone="primary" className="mx-auto" />

      <div className="mt-3">
        <h3 className="text-sm font-medium">Upload document</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Drag & drop a PDF, up to {formatMegabytes(maxSize)}</p>
      </div>

      <div className="mt-4">
        {phase.name === "idle" ? (
          <>
            <input type="file" accept=".pdf,application/pdf" onChange={handleFileInput} className="peer sr-only" id="file-upload" />
            <label htmlFor="file-upload" className="peer-focus-visible:[&>*]:ring-2 peer-focus-visible:[&>*]:ring-ring">
              <Button variant="outline" size="sm" className="w-full" asChild>
                <span className="cursor-pointer">
                  <File />
                  Choose file
                </span>
              </Button>
            </label>
          </>
        ) : (
          <div className="space-y-2" role="status" aria-live="polite">
            {phase.name === "uploading" ? (
              <Progress value={phase.progress} className="h-1.5" aria-label="Upload progress" />
            ) : (
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                {phase.name === "processing" && <Loader2 className="h-3 w-3 animate-spin" />}
                {phase.name === "uploading" ? `Uploading… ${phase.progress}%` : "Processing document…"}
              </span>
              {phase.name === "uploading" && (
                <button type="button" onClick={request.abort} className="flex items-center gap-0.5 hover:text-foreground" aria-label="Cancel upload">
                  <X className="h-3 w-3" /> Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadSection;
