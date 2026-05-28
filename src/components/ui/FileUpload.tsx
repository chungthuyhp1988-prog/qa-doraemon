import React, { useState, useRef } from 'react';
import { Upload, X, FileText, Image, Loader2 } from 'lucide-react';
import { uploadFile } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import { toast } from '../../stores/toastStore';

export interface FileUploadProps {
  bucket: string;
  folderPath?: string;
  value?: string; // public URL of uploaded file
  onChange: (url: string) => void;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  error?: string;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  bucket,
  folderPath = '',
  value,
  onChange,
  accept = 'image/*',
  maxSizeMB = 5,
  label,
  error,
  className,
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error('Kích thước file quá lớn', `File phải nhỏ hơn ${maxSizeMB}MB`);
      return;
    }

    setIsUploading(true);
    try {
      // Generate clean filename
      const ext = file.name.split('.').pop();
      const cleanFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
      const destPath = folderPath ? `${folderPath}/${cleanFileName}` : cleanFileName;
      
      const publicUrl = await uploadFile(bucket, destPath, file);
      onChange(publicUrl);
      toast.success('Tải lên thành công!', file.name);
    } catch (err: any) {
      console.error(err);
      toast.error('Tải lên thất bại', err.message || 'Lỗi không xác định');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isImage = value && (value.includes('.png') || value.includes('.jpg') || value.includes('.jpeg') || value.includes('.webp') || value.includes('image'));

  return (
    <div className={cn("flex flex-col gap-1.5 select-none", className)}>
      {label && (
        <span className="text-[13px] font-semibold text-on-surface tracking-[0.01em]">
          {label}
        </span>
      )}

      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 transition-all duration-200 cursor-pointer min-h-[140px]",
          isDragActive 
            ? "border-primary bg-primary/5" 
            : "border-outline-variant hover:border-outline hover:bg-surface-container-low/30",
          value && "border-solid bg-surface-container-low/20",
          error && "border-error focus-within:ring-error/20",
          isUploading && "pointer-events-none opacity-75"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <span className="text-xs text-on-surface-variant font-medium">Đang tải lên...</span>
          </div>
        ) : value ? (
          <div className="flex items-center gap-4 w-full">
            {isImage ? (
              <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-outline-variant bg-surface shrink-0">
                <img src={value} alt="Preview" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <FileText className="w-8 h-8" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">File đã chọn</span>
              <span className="text-sm font-semibold text-on-surface truncate block mt-0.5 max-w-[200px] select-all">
                {value.split('/').pop()?.substring(0, 30) || 'Uploaded file'}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="h-8 px-2 rounded-xl text-error border-error/20 hover:bg-error/5 hover:border-error/30 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <Upload className="w-8 h-8 text-on-surface-variant/60 mb-3" />
            <p className="text-sm font-semibold text-on-surface">
              Kéo thả file vào đây hoặc <span className="text-primary hover:underline">chọn file</span>
            </p>
            <p className="text-xs text-on-surface-variant mt-1.5">
              Hỗ trợ {accept.replace('/*', '')} tối đa {maxSizeMB}MB
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-[12px] text-error font-medium" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
