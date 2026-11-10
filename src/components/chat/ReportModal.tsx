import React, { useState } from 'react';
import { X, Flag, AlertTriangle } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'book' | 'user' | 'message';
  targetId: string;
  targetTitle: string;
  onSubmitReport: (reason: string, details: string) => Promise<void>;
}

const REPORT_REASONS = [
  'Inappropriate or offensive content',
  'Harassment or bullying',
  'Spam or misleading information',
  'Copyright infringement',
  'Hate speech or discrimination',
  'Violent or dangerous material',
  'Other violation',
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetTitle,
  onSubmitReport,
}) => {
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmitReport(selectedReason, details);
      onClose();
    } catch (err) {
      console.error('Failed to submit report:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-[#121217] rounded-2xl shadow-2xl border border-[#E5E5EB] dark:border-[#22222A] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-[#E43136]" />
            <h3 className="font-semibold text-base text-[#202020] dark:text-[#F4F4F6]">
              Report {targetType === 'message' ? 'Message' : targetType === 'book' ? 'Book' : 'User'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6E6E77] hover:text-[#202020] dark:hover:text-white hover:bg-[#F1F1F4] dark:hover:bg-[#1E1E26] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-xs text-[#6E6E77] dark:text-[#9E9EA8]">
            Reporting: <span className="font-semibold text-[#202020] dark:text-white">{targetTitle}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#202020] dark:text-[#F4F4F6] mb-2">
              Reason for report
            </label>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer text-xs transition-colors ${
                    selectedReason === reason
                      ? 'bg-[#FFF3F4] text-[#E43136] dark:bg-[#E43136]/15 font-medium'
                      : 'text-[#444] dark:text-[#CCC] hover:bg-[#F4F4F6] dark:hover:bg-[#1A1A22]'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="text-[#E43136] focus:ring-[#E43136]"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#202020] dark:text-[#F4F4F6] mb-1.5">
              Additional details (optional)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide any additional context for moderators..."
              rows={3}
              maxLength={500}
              className="w-full p-2.5 text-xs rounded-xl bg-[#F4F4F6] dark:bg-[#1B1B22] border-none text-[#202020] dark:text-[#F4F4F6] focus:ring-2 focus:ring-[#E43136] outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#6E6E77] hover:bg-[#EDEDF2] dark:hover:bg-[#1C1C24] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#E43136] hover:bg-[#D92D32] transition-colors shadow-xs cursor-pointer"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
