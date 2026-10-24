import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import API_CONFIG from "@/lib/api";
import IconBadge from "@/components/app/IconBadge";

interface UploadSectionProps {
  onUploadSuccess: (filename: string) => void;
}

const UploadSection = ({ onUploadSuccess }: UploadSectionProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleUpload = async (file: File) => {
    // Validate file size (20MB limit)
    const maxSize = 20 * 1024 * 1024; // 20MB in bytes
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 20MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // TODO: Replace with actual API endpoint
      const response = await fetch(API_CONFIG.ENDPOINTS.UPLOAD, {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.ok) {
        const data = await response.json();
        
        toast({
          title: "Upload successful!",
          description: `${file.name} has been processed`,
        });
        
        onUploadSuccess(file.name);
      } else {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 1000);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(f => f.type === "application/pdf");
    
    if (pdfFile) {
      handleUpload(pdfFile);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file",
        variant: "destructive",
      });
    }
  }, [toast, handleUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      handleUpload(file);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file",
        variant: "destructive",
      });
    }
  }, [toast, handleUpload]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-xl border border-dashed p-5 text-center transition-colors ${
        isDragging ? "border-primary bg-primary/5" : "bg-card hover:border-foreground/25"
      }`}
    >
      <IconBadge icon={Upload} size="sm" tone="primary" className="mx-auto" />

      <div className="mt-3">
        <h3 className="text-sm font-medium">Upload document</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Drag & drop a PDF, up to 20MB</p>
      </div>

      <div className="mt-4">
        {isUploading ? (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="h-1.5" />
            <p className="text-xs text-muted-foreground">Uploading… {uploadProgress}%</p>
          </div>
        ) : (
          <>
            <input type="file" accept=".pdf" onChange={handleFileInput} className="peer sr-only" id="file-upload" />
            <label htmlFor="file-upload" className="peer-focus-visible:[&>*]:ring-2 peer-focus-visible:[&>*]:ring-ring">
              <Button variant="outline" size="sm" className="w-full" asChild>
                <span className="cursor-pointer">
                  <File />
                  Choose file
                </span>
              </Button>
            </label>
          </>
        )}
      </div>
    </div>
  );
};

export default UploadSection;
