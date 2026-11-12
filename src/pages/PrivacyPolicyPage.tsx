import React from 'react';
import { ShieldCheck, Lock, Eye, FileText, Mail, Calendar } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-10 py-6 sm:py-10">
      {/* Header */}
      <div className="space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF3F4] dark:bg-[#E43136]/15 text-[#E43136] text-xs font-bold uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5" />
          Transparency & Trust
        </span>
        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#202020] dark:text-[#F5F5F7]">
          Privacy Policy
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-xs text-[#6E6E77] dark:text-[#9E9EA8] pt-1">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-[#E43136]" />
            Effective Date: November 9, 2026
          </span>
          <span>•</span>
          <span>Last Updated: November 9, 2026</span>
          <span>•</span>
          <span>Operating Context: India</span>
        </div>
      </div>

      {/* Main Content Box */}
      <div className="bg-white dark:bg-[#16161A] rounded-2xl sm:rounded-3xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 sm:p-10 space-y-8 text-sm text-[#4E4E56] dark:text-[#B0B0BC] leading-relaxed">
        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            1. Introduction & Overview
          </h2>
          <p>
            Welcome to Redcover (<a href="https://redcover.app" className="text-[#E43136] font-medium underline">https://redcover.app</a>). Redcover is a social reading and publishing platform created by Muzammil Khan, designed to bring together readers, authors, and book communities.
          </p>
          <p>
            This Privacy Policy describes how Redcover collects, uses, stores, and protects your information when you access our website, applications, APIs, and associated digital services. We are committed to transparency and respecting your digital privacy.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            2. Information We Collect
          </h2>
          <p>
            We only collect information that is genuinely required to provide our reading, writing, social, and co-reading services:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Account & Profile Information:</strong> When you register an account, we collect your name, username, email address, password hash, and optional profile bio and avatar image.
            </li>
            <li>
              <strong>User-Generated Content:</strong> Books, stories, chapters, covers, audio narrations, and PDF files you upload or publish, as well as comments, chapter annotations, reviews, and community posts.
            </li>
            <li>
              <strong>Communication & Social Features:</strong> Messages exchanged within direct chats, group discussions, reading invitations, and friend lists.
            </li>
            <li>
              <strong>Reading Journey Data:</strong> Books you save to your library, reading progress percentages, bookmark locations, reading streak counts, and synchronized co-reading session records.
            </li>
            <li>
              <strong>Device & Technical Diagnostics:</strong> IP addresses, browser types, device operating systems, general geographic region, and timestamps collected automatically for platform security and debugging.
            </li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            3. How We Use Your Information
          </h2>
          <p>We process your data strictly for legitimate operational purposes:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>To create, verify, and maintain your Redcover user account.</li>
            <li>To render the digital reader, synchronize reading progress across devices, and power live co-reading sessions.</li>
            <li>To deliver direct messaging, notifications, and community discussions.</li>
            <li>To safeguard users by detecting spam, automated bot abuse, harassment, and copyright violations.</li>
            <li>To respond to your support inquiries submitted through our contact channels.</li>
            <li>To analyze high-level platform performance to improve page loading and reading ergonomics.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            4. Cloud Infrastructure & Third-Party Services
          </h2>
          <p>
            Redcover uses Google cloud services for secure sign-in and file storage:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Google sign-in:</strong> Manages secure user authentication through OAuth.</li>
            <li><strong>Cloud Firestore & Realtime Database:</strong> Stores application metadata, book records, comments, and real-time chat messages.</li>
            <li><strong>Cloud file storage:</strong> Securely hosts user-uploaded book covers, chapter PDFs, and avatars.</li>
          </ul>
          <p>
            These processors handle your data strictly in accordance with modern security standards and industry best practices.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            5. Advertising & Cookie Disclosures (Google AdSense Readiness)
          </h2>
          <p>
            Redcover is an open reading platform supported by non-intrusive advertising. We may display advertisements through Google AdSense and qualified advertising partners on public pages:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits to this website or other websites on the Internet.
            </li>
            <li>
              Google's use of advertising cookies enables it and its partners to serve ads to users based on their visit to Redcover and/or other sites on the Internet.
            </li>
            <li>
              Users may opt out of personalized advertising by visiting{' '}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#E43136] underline"
              >
                Google Ads Settings
              </a>{' '}
              or via{' '}
              <a
                href="https://www.aboutads.info/choices/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#E43136] underline"
              >
                aboutads.info
              </a>.
            </li>
            <li>
              We strictly enforce an ad-safe policy: advertisements are never inserted into private messages, direct chats, or intrusive popups that interrupt reader content.
            </li>
          </ul>
        </section>

        {/* Section 6 */}
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            6. User Rights & Data Deletion
          </h2>
          <p>
            We empower you with control over your digital footprint:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Access & Correction:</strong> You can edit your display name, username, bio, and profile settings at any time in your Account Settings.
            </li>
            <li>
              <strong>Content Removal:</strong> Authors can delete or unpublish books they have authored directly from their dashboard.
            </li>
            <li>
              <strong>Account & Data Deletion:</strong> If you wish to permanently delete your account and all associated personal records, you can submit a deletion request to{' '}
              <a href="mailto:engeeo.io@gmail.com" className="text-[#E43136] font-semibold underline">
                engeeo.io@gmail.com
              </a>. Requests are processed within 30 days.
            </li>
          </ul>
        </section>

        {/* Section 7 */}
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            7. Data Security & Retention
          </h2>
          <p>
            We deploy appropriate administrative, technical, and physical safeguards, including encryption in transit (HTTPS/TLS) and secure database access rules. However, no internet transmission is ever 100% impenetrable; therefore, we cannot guarantee absolute security. We retain personal data only for as long as your account remains active or as required for legal compliance.
          </p>
        </section>

        {/* Section 8 */}
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            8. Children's Privacy
          </h2>
          <p>
            Redcover is intended for a general audience and is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe that a child under 13 has provided personal information to us, please notify us at{' '}
            <a href="mailto:engeeo.io@gmail.com" className="text-[#E43136] underline">
              engeeo.io@gmail.com
            </a>{' '}
            and we will take immediate steps to remove the data.
          </p>
        </section>

        {/* Section 9 */}
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            9. Contact & Inquiries
          </h2>
          <p>
            For any privacy inquiries, clarification, or data rights requests, please contact our team:
          </p>
          <div className="p-4 rounded-xl bg-[#FAFAFB] dark:bg-[#1C1C24] border border-[#DDDDE3] dark:border-[#2A2A36] space-y-1 text-xs">
            <p className="font-bold text-[#202020] dark:text-[#F5F5F7]">Redcover Privacy Office</p>
            <p>Founder & CEO: Muzammil Khan (AI & Data Science)</p>
            <p>
              Email:{' '}
              <a href="mailto:engeeo.io@gmail.com" className="text-[#E43136] font-semibold underline">
                engeeo.io@gmail.com
              </a>
            </p>
            <p>Instagram: @redcover.app</p>
          </div>
        </section>
      </div>
    </div>
  );
};
