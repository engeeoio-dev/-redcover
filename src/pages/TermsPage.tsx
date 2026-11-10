import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Shield, AlertTriangle, BookOpen, CheckCircle, Scale } from 'lucide-react';

export const TermsPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-10 py-6 sm:py-10">
      {/* Header */}
      <div className="space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF3F4] dark:bg-[#E43136]/15 text-[#E43136] text-xs font-bold uppercase tracking-wider">
          <Scale className="w-3.5 h-3.5" />
          Legal Agreement
        </span>
        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#202020] dark:text-[#F5F5F7]">
          Terms & Conditions
        </h1>
        <p className="text-xs sm:text-sm text-[#6E6E77] dark:text-[#9E9EA8]">
          Last Revised: November 9, 2026 • Operating Context: India
        </p>
      </div>

      <div className="bg-white dark:bg-[#16161A] rounded-2xl sm:rounded-3xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 sm:p-10 space-y-8 text-sm text-[#4E4E56] dark:text-[#B0B0BC] leading-relaxed">
        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing or using Redcover (<a href="https://redcover.app" className="text-[#E43136] underline">https://redcover.app</a>), you agree to be bound by these Terms & Conditions and our Privacy Policy. If you do not agree to these terms, please do not use our services.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            2. Eligibility & Registration
          </h2>
          <p>
            You must be at least 13 years of age to register for a Redcover account. You agree to provide accurate and truthful information during registration and to maintain the security of your account credentials. You are responsible for all activities that occur under your account.
          </p>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            3. Books & User-Generated Content Ownership
          </h2>
          <div className="p-4 rounded-xl bg-[#FFF3F4] dark:bg-[#1C1215] border border-[#E43136]/20 space-y-2">
            <p className="font-bold text-[#E43136] text-xs uppercase tracking-wide">
              Important: You Own Your Work
            </p>
            <p className="text-xs">
              Authors and creators retain 100% intellectual property ownership of all original books, manuscripts, chapters, and stories they publish on Redcover. Redcover does not claim ownership of your creative work.
            </p>
          </div>
          <p>
            By submitting or publishing content on Redcover, you grant Redcover a worldwide, non-exclusive, royalty-free, revocable license solely to host, store, display, format, distribute, and render that content to users in accordance with platform features (such as reading, chapter navigation, and co-reading) and your chosen privacy settings.
          </p>
          <p>
            You represent and warrant that you hold all necessary rights, licenses, and permissions to publish the content you upload, and that such content does not infringe the copyright, trademark, or rights of any third party.
          </p>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            4. Prohibited Content & Acceptable Use
          </h2>
          <p>You agree not to publish, transmit, or promote:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Unauthorized distributions of copyrighted books, commercial novels, or textbooks.</li>
            <li>Hate speech, harassment, bullying, defamation, or threats of violence.</li>
            <li>Sexually explicit, abusive, or exploitative content.</li>
            <li>Spam, deceptive commercial solicitation, or automated bot traffic.</li>
            <li>Malicious code, spyware, or attempts to circumvent platform security or database access rules.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            5. Copyright Infringement & Reporting
          </h2>
          <p>
            Redcover strongly upholds intellectual property rights. If you believe your copyrighted work has been uploaded without authorization, you may file a notice using our dedicated{' '}
            <Link to="/copyright" className="text-[#E43136] font-semibold underline">
              Copyright Reporting Process
            </Link>{' '}
            or by emailing{' '}
            <a href="mailto:engeeo.io@gmail.com" className="text-[#E43136] underline">
              engeeo.io@gmail.com
            </a>. Prompt removal and account penalties apply to confirmed violations.
          </p>
        </section>

        {/* Section 6 */}
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            6. Messaging, Groups & Shared Co-Reading
          </h2>
          <p>
            Users are expected to conduct themselves respectfully within direct chats, group forums, and synchronized reading sessions. Redcover provides blocking and reporting tools to allow any user to protect themselves from unwanted communication.
          </p>
        </section>

        {/* Section 7 */}
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            7. Advertisements & Platform Support
          </h2>
          <p>
            Redcover is provided as an open, accessible service supported by non-intrusive advertisements (including Google AdSense). Users agree that advertisements may be served on public catalog pages and landing views.
          </p>
        </section>

        {/* Section 8 */}
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            8. Disclaimer of Warranties & Limitation of Liability
          </h2>
          <p>
            Redcover is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind, whether express or implied. Redcover does not guarantee that the service will be uninterrupted, error-free, or entirely bug-free. In no event shall Redcover, its founder, or contributors be liable for any indirect, incidental, or consequential damages resulting from your use of the platform.
          </p>
        </section>

        {/* Section 9 */}
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            9. Governing Context & Contact
          </h2>
          <p>
            These terms are governed by the laws and initial operating context of India. For any inquiries regarding these terms, please contact:
          </p>
          <div className="p-4 rounded-xl bg-[#FAFAFB] dark:bg-[#1C1C24] border border-[#DDDDE3] dark:border-[#2A2A36] space-y-1 text-xs">
            <p className="font-bold text-[#202020] dark:text-[#F5F5F7]">Redcover Legal Inquiries</p>
            <p>Founder & CEO: Muzammil Khan (AI & Data Science)</p>
            <p>
              Email:{' '}
              <a href="mailto:engeeo.io@gmail.com" className="text-[#E43136] font-semibold underline">
                engeeo.io@gmail.com
              </a>
            </p>
            <p>Official Website: https://redcover.app</p>
          </div>
        </section>
      </div>
    </div>
  );
};
