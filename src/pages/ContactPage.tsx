import React, { useState } from 'react';
import { Mail, Instagram, Send, CheckCircle2, AlertCircle, Clock, MapPin, Sparkles } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase/firebaseConfig';
import { useRedcover } from '../contexts/RedcoverContext';

export const ContactPage: React.FC = () => {
  const { addToast } = useRedcover();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState(''); // Anti-bot field
  const [submitting, setSubmitting] = useState(false);
  const [submittedRefId, setSubmittedRefId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Spam Honeypot Detection
    if (honeypot.trim().length > 0) {
      // Silently fail bots without disclosing detection
      setSubmittedRefId('REF-OK-BOT');
      return;
    }

    // Input Validation
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    if (!cleanName || cleanName.length < 2) {
      setErrorMessage('Please enter your full name (at least 2 characters).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }

    if (!cleanSubject || cleanSubject.length < 3) {
      setErrorMessage('Please enter a brief subject.');
      return;
    }

    if (!cleanMessage || cleanMessage.length < 10) {
      setErrorMessage('Please enter a descriptive message (at least 10 characters).');
      return;
    }

    // Rate Limiting Check (e.g. 1 message every 45 seconds per browser)
    const lastSubmitTime = localStorage.getItem('rc_last_contact_ts');
    if (lastSubmitTime) {
      const elapsedSec = (Date.now() - parseInt(lastSubmitTime, 10)) / 1000;
      if (elapsedSec < 45) {
        setErrorMessage(`Please wait ${Math.ceil(45 - elapsedSec)} seconds before sending another message.`);
        return;
      }
    }

    setSubmitting(true);
    const refCode = `MSG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    try {
      await setDoc(doc(db, 'contactMessages', refCode), {
        referenceId: refCode,
        name: cleanName.slice(0, 100),
        email: cleanEmail.slice(0, 150),
        subject: cleanSubject.slice(0, 200),
        message: cleanMessage.slice(0, 4000),
        status: 'pending',
        platform: 'web',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 250) : '',
        createdAt: serverTimestamp(),
      });

      localStorage.setItem('rc_last_contact_ts', Date.now().toString());
      setSubmittedRefId(refCode);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
      addToast('Message received! Our team will get back to you.', 'success');
    } catch (err: any) {
      console.warn('Contact message submission notice:', err);
      // Fallback: If network issue, provide mailto link
      setErrorMessage(
        'Could not submit through the online form at this moment. You can directly email us at engeeo.io@gmail.com'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 py-6 sm:py-10">
      {/* Header */}
      <div className="text-center space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF3F4] dark:bg-[#E43136]/15 text-[#E43136] text-xs font-bold uppercase tracking-wider">
          <Mail className="w-3.5 h-3.5" />
          Get in Touch
        </span>
        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#202020] dark:text-[#F5F5F7]">
          Contact Redcover
        </h1>
        <p className="text-sm sm:text-base text-[#6E6E77] dark:text-[#9E9EA8] max-w-xl mx-auto leading-relaxed">
          Have questions about reading, publishing, community reporting, or partnerships? We are here to help.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Official Contact Channels */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 space-y-5">
            <h2 className="font-display text-lg font-bold text-[#202020] dark:text-[#F5F5F7]">
              Official Communication
            </h2>

            {/* Email Card */}
            <a
              href="mailto:engeeo.io@gmail.com"
              className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[#FAFAFB] dark:bg-[#1C1C24] hover:bg-[#FFF3F4] dark:hover:bg-[#E43136]/10 border border-[#DDDDE3] dark:border-[#2A2A36] transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-[#E43136]/10 text-[#E43136] flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] font-medium">Direct Inquiries</p>
                <p className="text-xs sm:text-sm font-semibold text-[#202020] dark:text-[#F5F5F7] group-hover:text-[#E43136] truncate">
                  engeeo.io@gmail.com
                </p>
              </div>
            </a>

            {/* Instagram Card */}
            <a
              href="https://www.instagram.com/redcover.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[#FAFAFB] dark:bg-[#1C1C24] hover:bg-[#FFF3F4] dark:hover:bg-[#E43136]/10 border border-[#DDDDE3] dark:border-[#2A2A36] transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-[#E43136]/10 text-[#E43136] flex items-center justify-center shrink-0">
                <Instagram className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] font-medium">Instagram Community</p>
                <p className="text-xs sm:text-sm font-semibold text-[#202020] dark:text-[#F5F5F7] group-hover:text-[#E43136] truncate">
                  @redcover.app
                </p>
              </div>
            </a>

            {/* Operating Context */}
            <div className="pt-2 border-t border-[#F1F1F4] dark:border-[#24242F] space-y-2 text-xs text-[#6E6E77] dark:text-[#9E9EA8]">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#E43136] shrink-0" />
                <span>Operating Context: India</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#E43136] shrink-0" />
                <span>Responses reviewed during regular operating hours</span>
              </div>
            </div>
          </div>

          {/* Quick Info Box */}
          <div className="bg-[#FFF3F4] dark:bg-[#1F1417] border border-[#E43136]/20 rounded-2xl p-5 space-y-2 text-xs">
            <p className="font-bold text-[#E43136]">Notice regarding Copyright & Safety:</p>
            <p className="text-[#6E6E77] dark:text-[#9E9EA8] leading-relaxed">
              If you are reporting copyright infringement or inappropriate content, please use our dedicated{' '}
              <a href="/copyright" className="text-[#E43136] font-semibold underline">
                Copyright Reporting Process
              </a>{' '}
              or specify the book identifier in your message.
            </p>
          </div>
        </div>

        {/* Right Column: Working Contact Form */}
        <div className="lg:col-span-7 bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
              Send Us a Message
            </h2>
            <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8]">
              Fill out the form below and we will receive your inquiry directly in our admin queue.
            </p>
          </div>

          {submittedRefId ? (
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="font-display text-lg font-bold text-[#202020] dark:text-[#F5F5F7]">
                Thank You for Contacting Us
              </h3>
              <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] max-w-sm mx-auto">
                Your message has been safely recorded with reference ID:
                <br />
                <span className="font-mono font-bold text-[#202020] dark:text-[#F5F5F7] text-sm mt-1 inline-block">
                  {submittedRefId}
                </span>
              </p>
              <button
                type="button"
                onClick={() => setSubmittedRefId(null)}
                className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Bot trap honeypot (hidden from human users) */}
              <div style={{ display: 'none' }} aria-hidden="true">
                <input
                  type="text"
                  name="website_bot_trap"
                  tabIndex={-1}
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  autoComplete="off"
                />
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#202020] dark:text-[#F5F5F7] mb-1.5">
                    Your Name <span className="text-[#E43136]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full py-2.5 px-3.5 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent text-xs sm:text-sm focus:outline-none focus:border-[#E43136]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#202020] dark:text-[#F5F5F7] mb-1.5">
                    Email Address <span className="text-[#E43136]">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full py-2.5 px-3.5 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent text-xs sm:text-sm focus:outline-none focus:border-[#E43136]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#202020] dark:text-[#F5F5F7] mb-1.5">
                  Subject <span className="text-[#E43136]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Question about book publishing"
                  className="w-full py-2.5 px-3.5 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent text-xs sm:text-sm focus:outline-none focus:border-[#E43136]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#202020] dark:text-[#F5F5F7] mb-1.5">
                  Message <span className="text-[#E43136]">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we assist you? Please provide relevant details..."
                  className="w-full py-2.5 px-3.5 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent text-xs sm:text-sm focus:outline-none focus:border-[#E43136] resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl bg-[#E43136] hover:bg-[#B9272D] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Transmitting message...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
