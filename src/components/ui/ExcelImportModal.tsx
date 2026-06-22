import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { readExcelFile, downloadExcelTemplate } from '../../lib/excelHelper';
import { toast } from '../../stores/toastStore';

interface ExcelImportModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  templateType: 'students' | 'teachers' | 'registrations';
  onImport: (rows: any[]) => Promise<{ successCount: number; errorCount: number; errors?: string[] }>;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  open,
  onClose,
  title,
  templateType,
  onImport,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loaded' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<{ successCount: number; errorCount: number; errors?: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const selectedFile = files[0];
    const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
    if (fileExt !== 'xlsx' && fileExt !== 'xls' && fileExt !== 'csv') {
      toast.error('Vui lòng chọn file Excel (.xlsx, .xls) hoặc tệp CSV (.csv)');
      return;
    }

    setFile(selectedFile);
    setLoading(true);
    try {
      const data = await readExcelFile(selectedFile);
      if (data.length === 0) {
        toast.error('File Excel không có dữ liệu hoặc định dạng không đúng.');
        setStatus('idle');
        setFile(null);
      } else {
        setPreviewData(data);
        setStatus('loaded');
        toast.success(`Đọc thành công ${data.length} dòng dữ liệu!`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi đọc file Excel: ' + (err.message || 'Lỗi định dạng'));
      setStatus('idle');
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    
    const selectedFile = files[0];
    const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
    if (fileExt !== 'xlsx' && fileExt !== 'xls' && fileExt !== 'csv') {
      toast.error('Vui lòng chọn file Excel (.xlsx, .xls) hoặc tệp CSV (.csv)');
      return;
    }

    setFile(selectedFile);
    setLoading(true);
    try {
      const data = await readExcelFile(selectedFile);
      if (data.length === 0) {
        toast.error('File Excel không có dữ liệu hoặc định dạng không đúng.');
        setStatus('idle');
        setFile(null);
      } else {
        setPreviewData(data);
        setStatus('loaded');
        toast.success(`Đọc thành công ${data.length} dòng dữ liệu!`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi đọc file Excel: ' + (err.message || 'Lỗi định dạng'));
      setStatus('idle');
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate(templateType);
  };

  const handleImportSubmit = async () => {
    if (previewData.length === 0) return;
    setLoading(true);
    try {
      const res = await onImport(previewData);
      setResult(res);
      setStatus('success');
      toast.success(`Nhập dữ liệu thành công! ${res.successCount} dòng được lưu.`);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      toast.error('Có lỗi xảy ra khi nhập dữ liệu vào cơ sở dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setFile(null);
    setPreviewData([]);
    setStatus('idle');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <RefreshCw className="w-10 h-10 text-primary animate-spin" />
          <p className="text-[14px] text-on-surface-variant font-medium">Đang xử lý dữ liệu, vui lòng đợi...</p>
        </div>
      );
    }

    if (status === 'success' && result) {
      return (
        <div className="space-y-6 py-4">
          <div className="flex flex-col items-center justify-center text-center space-y-2">
            <CheckCircle className="w-14 h-14 text-emerald-600" />
            <h3 className="text-[18px] font-bold text-on-surface">Hoàn thành nhập dữ liệu!</h3>
            <p className="text-[14px] text-on-surface-variant max-w-sm">
              Hệ thống đã lưu trữ thành công các thông tin hợp lệ từ file Excel của bạn.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-surface-container rounded-2xl p-4 border border-outline-variant/30">
            <div className="text-center border-r border-outline-variant/30">
              <div className="text-[28px] font-extrabold text-emerald-600">{result.successCount}</div>
              <div className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Thành công</div>
            </div>
            <div className="text-center">
              <div className="text-[28px] font-extrabold text-error">{result.errorCount}</div>
              <div className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Bị lỗi/Bỏ qua</div>
            </div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="space-y-2 bg-error-container/20 border border-error/20 rounded-2xl p-4">
              <h4 className="text-[13px] font-extrabold text-error flex items-center gap-1.5 uppercase tracking-wider">
                <AlertCircle className="w-4 h-4" /> Danh sách lỗi phát sinh:
              </h4>
              <ul className="text-[12px] text-error font-medium list-disc list-inside space-y-1 max-h-36 overflow-y-auto pr-2">
                {result.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button onClick={resetModal} variant="outline" size="md">
              Nhập tiếp tệp khác
            </Button>
            <Button onClick={onClose} variant="primary" size="md">
              Đóng
            </Button>
          </div>
        </div>
      );
    }

    if (status === 'loaded' && previewData.length > 0) {
      // Lấy danh sách header để hiển thị preview
      const previewHeaders = Object.keys(previewData[0]);
      
      return (
        <div className="space-y-4 py-2 flex flex-col max-h-[70vh]">
          <div className="flex justify-between items-center bg-surface-container rounded-xl p-3 border border-outline-variant/30 shrink-0">
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              <div>
                <div className="text-[13px] font-bold text-on-surface truncate max-w-xs md:max-w-md">{file?.name}</div>
                <div className="text-[11px] text-on-surface-variant font-medium">Tìm thấy {previewData.length} dòng dữ liệu</div>
              </div>
            </div>
            <Button onClick={resetModal} variant="outline" size="sm" className="px-3 py-1">
              Chọn lại file
            </Button>
          </div>

          {/* Dữ liệu Preview */}
          <div className="flex-1 overflow-auto border border-outline-variant/20 rounded-xl bg-white max-h-[350px]">
            <table className="w-full border-collapse text-[13px] text-left">
              <thead className="bg-surface-container sticky top-0 border-b border-outline-variant/30">
                <tr>
                  {previewHeaders.map((header) => (
                    <th key={header} className="p-3 font-semibold text-on-surface-variant whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="border-b border-outline-variant/10 hover:bg-surface-container-low/20">
                    {previewHeaders.map((header) => (
                      <td key={header} className="p-3 text-on-surface whitespace-nowrap truncate max-w-[200px]">
                        {row[header]?.toString() || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {previewData.length > 10 && (
              <div className="p-3 text-center text-[12px] text-on-surface-variant font-medium bg-surface-container-low/30 border-t border-outline-variant/10">
                Hiển thị 10 trên tổng số {previewData.length} dòng...
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/20 shrink-0">
            <Button onClick={onClose} variant="outline" size="md">
              Hủy bỏ
            </Button>
            <Button onClick={handleImportSubmit} variant="primary" size="md">
              Xác nhận nhập ({previewData.length} dòng)
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5 py-4">
        {/* Nút tải template */}
        <div className="flex items-center justify-between p-4 bg-primary-container/20 border border-primary/20 rounded-2xl">
          <div className="space-y-0.5">
            <h4 className="text-[14px] font-bold text-primary">Tải file Excel mẫu</h4>
            <p className="text-[12px] text-on-surface-variant font-medium">Sử dụng đúng cấu trúc cột để hệ thống nhận diện chính xác dữ liệu.</p>
          </div>
          <Button onClick={handleDownloadTemplate} variant="outline" size="sm" className="flex items-center gap-1.5 text-primary border-primary hover:bg-primary/5 cursor-pointer">
            <Download className="w-4 h-4" /> Tải file mẫu
          </Button>
        </div>

        {/* Khu vực kéo thả file */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center border-2 border-dashed border-outline-variant/50 hover:border-primary/70 rounded-3xl p-10 bg-surface-container-low/20 hover:bg-surface-container-low/40 transition-all cursor-pointer select-none space-y-3"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
          <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center border border-primary/10">
            <Upload className="w-6 h-6 text-primary" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-[14px] font-bold text-on-surface">Kéo thả tệp hoặc Nhấn để tải lên</p>
            <p className="text-[12px] text-on-surface-variant font-medium">Hỗ trợ định dạng .xlsx, .xls, .csv</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size={status === 'loaded' ? 'lg' : 'md'}
      closeOnOverlay={status !== 'loaded' && !loading}
      showCloseButton={!loading}
    >
      {renderContent()}
    </Modal>
  );
};
