import React from 'react';
import { Link } from 'react-router-dom';
import { HeartHandshake, ShieldAlert, CheckCircle2, MessageSquare, Flag, UserX, AlertOctagon } from 'lucide-react';

export const CommunityGuidelinesPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-10 py-6 sm:py-10">
      <div className="text-center space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF3F4] dark:bg-[#E43136]/15 text-[#E43136] text-xs font-bold uppercase tracking-wider">
          <HeartHandshake className="w-3.5 h-3.5" />
          Community Standards
        </span>
        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#202020] dark:text-[#F5F5F7]">
          Redcover Community Guidelines
        </h1>
        <p className="text-sm sm:text-base text-[#6E6E77] dark:text-[#9E9EA8] max-w-xl mx-auto">
          Our mission is to foster a safe, respectful, and inspiring environment for book lovers, authors, and reading circles.
        </p>
      </div>

      <div className="bg-white dark:bg-[#16161A] rounded-2xl sm:rounded-3xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 sm:p-10 space-y-8 text-sm text-[#4E4E56] dark:text-[#B0B0BC] leading-relaxed">
        {/* Section 1: Core Values */}
        <div className="space-y-3">
          <h2 className="font-display text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            1. Respect and Mutual Encouragement
          </h2>
          <p>
            Redcover is built on a shared passion for literature and storytelling. Treat fellow readers, authors, and reviewers with kindness and courtesy, even during spirited literary debates. Constructive critique is welcomed; personal attacks and harassment are strictly prohibited.
          </p>
        </div>

        {/* Section 2: Prohibited Conduct */}
        <div className="space-y-4">
          <h2 className="font-display text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            2. Prohibited Behaviors
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#FAFAFB] dark:bg-[#1C1C24] border border-[#DDDDE3] dark:border-[#2A2A36] space-y-1.5">
              <div className="flex items-center gap-2 text-red-600 font-bold text-xs">
                <AlertOctagon className="w-4 h-4" />
                <span>Harassment & Hate Speech</span>
              </div>
              <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8]">
                We do not tolerate abusive messages, threats, stalking, bigotry, or discrimination targeting any individual or group.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#FAFAFB] dark:bg-[#1C1C24] border border-[#DDDDE3] dark:border-[#2A2A36] space-y-1.5">
              <div className="flex items-center gap-2 text-red-600 font-bold text-xs">
                <ShieldAlert className="w-4 h-4" />
                <span>Copyright Violations</span>
              </div>
              <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8]">
                Do not upload pirated manuscripts, commercial scans, or books without explicit permission from the copyright owner.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#FAFAFB] dark:bg-[#1C1C24] border border-[#DDDDE3] dark:border-[#2A2A36] space-y-1.5">
              <div className="flex items-center gap-2 text-red-600 font-bold text-xs">
                <MessageSquare className="w-4 h-4" />
                <span>Spam & Solicitation</span>
              </div>
              <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8]">
                Repeated automated messages, affiliate spam, manipulative review trading, and disruptive advertising in chats are forbidden.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#FAFAFB] dark:bg-[#1C1C24] border border-[#DDDDE3] dark:border-[#2A2A36] space-y-1.5">
              <div className="flex items-center gap-2 text-red-600 font-bold text-xs">
                <UserX className="w-4 h-4" />
                <span>Impersonation</span>
              </div>
              <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8]">
                Pretending to be another author, reader, or Redcover staff member is strictly banned.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Safe Reading & Co-Reading Tools */}
        <div className="space-y-3">
          <h2 className="font-display text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            3. Protecting Yourself on Redcover
          </h2>
          <p>
            We provide interactive safety controls in your hands:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Direct In-App Blocking:</strong> You can block any user from their profile or direct chat. A blocked user cannot message you or invite you to co-reading sessions.
            </li>
            <li>
              <strong>Reporting Content:</strong> Click the three-dots menu on any book card, social post, comment, or message to submit an instant report to Redcover Trust & Safety.
            </li>
            <li>
              <strong>Privacy Settings:</strong> You can toggle your online visibility and reading activity privacy directly from your account settings.
            </li>
          </ul>
        </div>

        {/* Section 4: Enforcement */}
        <div className="space-y-3">
          <h2 className="font-display text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            4. Moderation & Enforcement
          </h2>
          <p>
            Violations of these guidelines are investigated by our team and may result in:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Content removal (delisting or deletion of infringing books or comments).</li>
            <li>Temporary suspension of publishing or messaging privileges.</li>
            <li>Permanent account termination and ban from the platform.</li>
          </ul>
          <p className="pt-2">
            Questions regarding our guidelines can be submitted to{' '}
            <a href="mailto:engeeo.io@gmail.com" className="text-[#E43136] underline font-medium">
              engeeo.io@gmail.com
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
};
