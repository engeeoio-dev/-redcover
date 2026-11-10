import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, AlertCircle, Send, BookOpen, Mail } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase/firebaseConfig';
import { useRedcover } from '../contexts/RedcoverContext';

export const CopyrightPolicyPage: React.FC = () => {
  const { addToast } = useRedcover();

  const [claimantName, setClaimantName] = useState('');
  const [claimantEmail, setClaimantEmail] = useState('');
  const [workTitle, setWorkTitle] = useState('');
  const [bookIdentifier, setBookIdentifier] = useState('');
  const [description, setDescription] = useState('');
  const [goodFaithChecked, setGoodFaithChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!goodFaithChecked) {
      setErrorMsg('You must check the good-faith declaration to proceed.');
      return;
    }

    if (!claimantName.trim() || !claimantEmail.trim() || !workTitle.trim() || !description.trim()) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    setSubmitting(true);
    const reportCode = `CR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    try {
      await setDoc(doc(db, 'reports', reportCode), {
        id: reportCode,
        targetType: 'copyright',
        claimantName: claimantName.trim(),
        claimantEmail: claimantEmail.trim().toLowerCase(),
        workTitle: workTitle.trim(),
        bookIdentifier: bookIdentifier.trim(),
        reason: description.trim(),
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSubmittedRef(reportCode);
      addToast('Copyright report filed. Our Trust & Safety team will review it.', 'success');
    } catch (err: any) {
      console.warn('Copyright report submission error:', err);
      setErrorMsg('Could not submit report online. Please directly email your claim to engeeo.io@gmail.com');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 py-6 sm:py-10">
      <div className="text-center space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF3F4] dark:bg-[#E43136]/15 text-[#E43136] text-xs font-bold uppercase tracking-wider">
          <ShieldAlert className="w-3.5 h-3.5" />
          Intellectual Property Protection
        </span>
        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#202020] dark:text-[#F5F5F7]">
          Copyright Policy & Infringement Reporting
        </h1>
        <p className="text-sm sm:text-base text-[#6E6E77] dark:text-[#9E9EA8] max-w-xl mx-auto">
          Redcover respects the rights of copyright holders and authors. We expeditiously respond to legitimate notices of alleged infringement.
        </p>
      </div>

      <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 sm:p-8 space-y-6">
        <div className="space-y-3 text-xs sm:text-sm text-[#4E4E56] dark:text-[#B0B0BC] leading-relaxed border-b border-[#F1F1F4] dark:border-[#24242F] pb-6">
          <h2 className="font-display text-base sm:text-lg font-bold text-[#202020] dark:text-[#F5F5F7]">
            Notice and Takedown Policy
          </h2>
          <p>
            If you are a copyright owner, author, or authorized agent, and you believe that any material published on Redcover infringes upon your copyright, you may submit a takedown notification using the form below or by writing directly to{' '}
            <a href="mailto:engeeo.io@gmail.com" className="text-[#E43136] font-semibold underline">
              engeeo.io@gmail.com
            </a>.
          </p>
        </div>

        {submittedRef ? (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="font-display text-lg font-bold text-[#202020] dark:text-[#F5F5F7]">
              Notice Submitted Successfully
            </h3>
            <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] max-w-sm mx-auto">
              Your takedown report has been logged under reference code:
              <br />
              <span className="font-mono font-bold text-sm text-[#202020] dark:text-[#F5F5F7] mt-1 inline-block">
                {submittedRef}
              </span>
            </p>
            <p className="text-[11px] text-[#8E8E98]">
              Our moderation team reviews complaints promptly. If additional documentation is required, we will reach out via the provided contact email.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#202020] dark:text-[#F5F5F7] mb-1.5">
                  Rights Holder / Agent Name <span className="text-[#E43136]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={claimantName}
                  onChange={(e) => setClaimantName(e.target.value)}
                  placeholder="Your full legal name"
                  className="w-full py-2.5 px-3.5 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent text-xs sm:text-sm focus:outline-none focus:border-[#E43136]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#202020] dark:text-[#F5F5F7] mb-1.5">
                  Contact Email <span className="text-[#E43136]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={claimantEmail}
                  onChange={(e) => setClaimantEmail(e.target.value)}
                  placeholder="legal@rightsowner.com"
                  className="w-full py-2.5 px-3.5 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent text-xs sm:text-sm focus:outline-none focus:border-[#E43136]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#202020] dark:text-[#F5F5F7] mb-1.5">
                Title of Original Copyrighted Work <span className="text-[#E43136]">*</span>
              </label>
              <input
                type="text"
                required
                value={workTitle}
                onChange={(e) => setWorkTitle(e.target.value)}
                placeholder="e.g. Original Book Title or ISBN"
                className="w-full py-2.5 px-3.5 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent text-xs sm:text-sm focus:outline-none focus:border-[#E43136]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#202020] dark:text-[#F5F5F7] mb-1.5">
                Redcover Book URL, Title, or Book ID
              </label>
              <input
                type="text"
                value={bookIdentifier}
                onChange={(e) => setBookIdentifier(e.target.value)}
                placeholder="https://redcover.app/book/book_id or title on Redcover"
                className="w-full py-2.5 px-3.5 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent text-xs sm:text-sm focus:outline-none focus:border-[#E43136]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#202020] dark:text-[#F5F5F7] mb-1.5">
                Description of Alleged Infringement <span className="text-[#E43136]">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please explain how this material infringes upon your copyright and provide any relevant proof of ownership..."
                className="w-full py-2.5 px-3.5 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent text-xs sm:text-sm focus:outline-none focus:border-[#E43136] resize-none"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAFAFB] dark:bg-[#1E1E26] border border-[#DDDDE3] dark:border-[#2A2A36]">
              <label className="flex items-start gap-2.5 text-xs text-[#4E4E56] dark:text-[#B0B0BC] cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={goodFaithChecked}
                  onChange={(e) => setGoodFaithChecked(e.target.checked)}
                  className="mt-0.5 rounded text-[#E43136] focus:ring-[#E43136]"
                />
                <span>
                  I have a good-faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law, and that the information in this notification is accurate under penalty of perjury.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-[#E43136] hover:bg-[#B9272D] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Submitting Report...' : 'Submit Copyright Notice'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
