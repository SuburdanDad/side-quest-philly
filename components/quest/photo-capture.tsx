"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Camera, RotateCcw, Check, X } from "lucide-react";

type PhotoCaptureProps = {
  open: boolean;
  objectiveTitle: string;
  onCapture: (file: File) => void;
  onClose: () => void;
};

export function PhotoCapture({
  open,
  objectiveTitle,
  onCapture,
  onClose,
}: PhotoCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);

  // Auto-open camera when modal opens
  useEffect(() => {
    if (open && !preview) {
      // Small delay to let the modal render first
      const timer = setTimeout(() => {
        fileInputRef.current?.click();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open, preview]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        // User cancelled the camera/picker
        if (!preview) onClose();
        return;
      }

      setCapturedFile(file);
      const url = URL.createObjectURL(file);
      setPreview(url);
    },
    [onClose, preview],
  );

  const handleConfirm = useCallback(() => {
    if (capturedFile) {
      onCapture(capturedFile);
      // Clean up
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setCapturedFile(null);
    }
  }, [capturedFile, onCapture, preview]);

  const handleRetake = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setCapturedFile(null);
    // Reset the input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
  }, [preview]);

  const handleClose = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setCapturedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  }, [onClose, preview]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Capture photo proof"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#0F1D36]/95 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 mb-3">
            <Camera className="h-3.5 w-3.5 text-[#C9A84C]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#C9A84C]">
              Photo Proof
            </span>
          </div>
          <p className="text-white/70 text-sm px-4 leading-relaxed">
            Snap a photo to prove you completed this quest!
          </p>
          <p className="text-white font-semibold text-sm mt-1">
            {objectiveTitle}
          </p>
        </div>

        {/* Photo preview area */}
        {preview ? (
          <div className="relative rounded-2xl overflow-hidden border-2 border-[#C9A84C]/30 shadow-[0_0_30px_rgba(201,168,76,0.15)]">
            <img
              src={preview}
              alt="Your photo proof"
              className="w-full aspect-[4/3] object-cover"
            />

            {/* Action buttons overlay */}
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex gap-3">
                <button
                  onClick={handleRetake}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/15 backdrop-blur-md py-3 text-white text-sm font-semibold hover:bg-white/25 transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retake
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#C9A84C] py-3 text-[#0F1D36] text-sm font-bold hover:bg-[#C9A84C]/90 transition-colors"
                >
                  <Check className="h-4 w-4" />
                  Looks Good!
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-white/20 bg-white/5 aspect-[4/3] flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
              <Camera className="h-7 w-7 text-white/40" />
            </div>
            <p className="text-white/30 text-xs">Opening camera...</p>
          </div>
        )}

        {/* Close button */}
        <button
          onClick={handleClose}
          className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-xl border border-white/15 py-2.5 text-white/50 text-sm hover:text-white/70 hover:border-white/25 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Skip photo
        </button>

        {/* Hidden file input — camera capture on mobile */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
