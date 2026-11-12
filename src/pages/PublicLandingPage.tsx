import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Feather,
  Users,
  Sparkles,
  ShieldCheck,
  Award,
  Check,
  Mail,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Instagram,
  Heart,
  Eye,
  Star,
  Lock,
  Compass,
} from 'lucide-react';
import { useRedcover } from '../contexts/RedcoverContext';
import { BookCover } from '../components/common/UIPrimitives';

export const PublicLandingPage: React.FC = () => {
  const {
    books,
    loginWithGoogle,
  } = useRedcover();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);

  // FAQ Accordion state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Featured books from real published catalog
  const featuredBooks = books
    .filter((b) => b.status === 'published')
    .slice(0, 6);

  const handleGoogleAuth = async () => {
    setSubmitting(true);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch {
      // Handled by context toast
    } finally {
      setSubmitting(false);
    }
  };



  const faqs = [
    {
      q: 'Is Redcover completely free to join and read?',
      a: 'Yes. Redcover is an open, ad-supported platform. You can discover books, read chapters, and build your library without any subscription paywalls.',
    },
    {
      q: 'Can I publish my own original stories and books?',
      a: 'Absolutely. Creators and indie authors can write stories, upload manuscripts, design covers, and publish directly to the community. Authors retain 100% intellectual property rights to their work.',
    },
    {
      q: 'What is "Co-Reading" and how does it work?',
      a: 'Co-Reading is Redcover’s synchronized reading feature. You can invite a friend to read a book together in real time, with synchronized page navigation, mutual presence, and in-line chapter discussions.',
    },
    {
      q: 'Can I read books without creating an account?',
      a: 'Yes. Visitors can freely browse the catalog on the Explore page and read publicly available books. Creating a free account lets you bookmark, like, leave reviews, chat, and write your own books.',
    },
    {
      q: 'How does Redcover handle copyright and privacy?',
      a: 'We strictly protect original authors and adhere to Indian and international digital copyright norms. Uploading copyrighted books without authorization is prohibited, and our moderation team investigates takedown requests promptly.',
    },
  ];

  return (
    <div className="w-full space-y-16 sm:space-y-24 pb-12">
      {/* =====================================================================
          1. HERO SECTION (Mirroring Reference Design Exactly)
      ===================================================================== */}
      <section className="relative rounded-3xl overflow-hidden border border-[#DDDDE3] dark:border-[#22222A] bg-black shadow-2xl">
        {/* Background Visual: Atmospheric Cozy Reading Room */}
        <div className="absolute inset-0 z-0">
          <img
            src="/assets/hero-banner.jpg"
            alt="Redcover Social Reading Community"
            className="w-full h-full object-cover object-center opacity-40 sm:opacity-50 blur-[0.5px]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/80 to-black/60 sm:to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90" />
        </div>

        {/* Hero Inner Grid */}
        <div className="relative z-10 p-6 sm:p-10 lg:p-14 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Brand Headline & Highlights */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-white">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-semibold tracking-wide">
              <BookOpen className="w-3.5 h-3.5 text-[#E43136]" />
              <span>India&apos;s Social Reading &amp; Publishing Platform</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-2">
              <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
                Read • Write • Publish
                <br />
                Connect • <span className="text-[#E43136] drop-shadow-sm">Co-Read</span>
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-gray-300 max-w-xl leading-relaxed pt-2">
                Redcover is a next-generation platform for book lovers and creators — read meaningful books, publish your own stories, discuss ideas, join reading groups, and read together with friends in real time.
              </p>
            </div>

            {/* 4 Feature Highlights Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 sm:p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-[#E43136]/50 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-[#E43136]/20 text-[#E43136] flex items-center justify-center mb-2.5">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-white">Read Books</h4>
                <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">
                  Discover a growing library of original and curated books
                </p>
              </div>

              <div className="p-3 sm:p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-[#E43136]/50 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-[#E43136]/20 text-[#E43136] flex items-center justify-center mb-2.5">
                  <Feather className="w-4 h-4" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-white">Write &amp; Publish</h4>
                <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">
                  Share your stories with a global reading community
                </p>
              </div>

              <div className="p-3 sm:p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-[#E43136]/50 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-[#E43136]/20 text-[#E43136] flex items-center justify-center mb-2.5">
                  <Users className="w-4 h-4" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-white">Groups</h4>
                <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">
                  Discuss books, ideas and your favourite authors
                </p>
              </div>

              <div className="p-3 sm:p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-[#E43136]/50 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-[#E43136]/20 text-[#E43136] flex items-center justify-center mb-2.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-white">Co-Reading</h4>
                <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">
                  Read together with friends in real time
                </p>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center gap-6 pt-3 text-xs text-gray-300 border-t border-white/10">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#E43136]" />
                <span>A growing community of readers and writers</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>A safe, respectful and creative space for everyone</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Floating "Join Redcover" Card */}
          <div className="lg:col-span-5">
            <div className="bg-white dark:bg-[#16161D] rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/20 text-[#202020] dark:text-[#F5F5F7] space-y-5">
              {/* Card Header with Logo */}
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2">
                  <img
                    src="/assets/aistudio/WhatsApp_Image_2026-10-24_at_6.29.36_PM_8a2e5d20.jpeg"
                    alt="Redcover"
                    className="w-7 h-7 rounded-lg object-cover"
                  />
                  <span className="font-display text-xl font-bold text-[#E43136]">
                    Redcover
                  </span>
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight">
                  Join Redcover
                </h2>
                <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] max-w-xs mx-auto">
                  Create your account and step into a world of books, ideas and fellow readers.
                </p>
              </div>

              {/* Value Checklist */}
              <ul className="space-y-2 text-xs text-[#4E4E56] dark:text-[#B0B0BC]">
                  {[
                    'Read meaningful books',
                    'Publish your own work',
                    'Join groups and discussions',
                    'Read together in real time',
                    'Build your personal library',
                    'A safe and ad-supported free platform',
                  ].map((benefit) => (
                    <li key={benefit} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-[#FFF3F4] dark:bg-[#E43136]/15 text-[#E43136] flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>

              <div className="space-y-3 pt-2">
                <button type="button" disabled={submitting} onClick={handleGoogleAuth} className="w-full py-3 px-4 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] hover:bg-[#FAFAFB] dark:hover:bg-[#1E1E26] text-sm font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50">
                  <span className="text-lg font-bold text-[#4285F4]">G</span>
                  <span>{submitting ? 'Connecting…' : 'Sign in or sign up with Google'}</span>
                </button>
                <p className="text-center text-[11px] text-[#777780] dark:text-[#9E9EA8]">Use your Google account to continue to Redcover.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Bar Below Hero (Mirroring the Reference Image Bottom Strip) */}
        <div className="relative z-10 border-t border-white/10 bg-black/60 backdrop-blur-md px-6 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-white">
          {/* Founder Section */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#E43136] text-white font-bold flex items-center justify-center shrink-0 text-xs">
              MK
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-medium">Founder &amp; CEO</p>
              <p className="font-bold text-white text-xs">Muzammil Khan</p>
              <p className="text-[10px] text-gray-400">AI &amp; Data Science</p>
            </div>
          </div>

          {/* Contact */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#E43136] shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-medium">Contact Us</p>
              <a href="mailto:engeeo.io@gmail.com" className="font-medium hover:text-[#E43136] transition-colors">
                engeeo.io@gmail.com
              </a>
            </div>
          </div>

          {/* Instagram */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#E43136] shrink-0">
              <Instagram className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-medium">Follow on Instagram</p>
              <a
                href="https://www.instagram.com/redcover.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:text-[#E43136] transition-colors"
              >
                @redcover.app
              </a>
            </div>
          </div>

          {/* Learn More */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#E43136] shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-medium">Learn More</p>
              <div className="flex items-center gap-2 text-[11px] text-gray-300">
                <Link to="/about" className="hover:text-white transition-colors">About Us</Link>
                <span>•</span>
                <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                <span>•</span>
                <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. HOW REDCOVER WORKS (3 Simple Steps)
      ===================================================================== */}
      <section className="space-y-8">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <span className="text-xs font-bold text-[#E43136] uppercase tracking-wider">
            Simple &amp; Seamless
          </span>
          <h2 className="font-display text-2xl sm:text-4xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            How Redcover Works
          </h2>
          <p className="text-xs sm:text-sm text-[#6E6E77] dark:text-[#9E9EA8]">
            Experience a reading platform that unites reading, writing, and community.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 space-y-4 relative">
            <div className="w-10 h-10 rounded-xl bg-[#FFF3F4] dark:bg-[#E43136]/15 text-[#E43136] font-display font-bold text-base flex items-center justify-center">
              01
            </div>
            <h3 className="font-display text-lg font-bold text-[#202020] dark:text-[#F5F5F7]">
              Discover &amp; Read
            </h3>
            <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] leading-relaxed">
              Explore stories across genres. Read directly in your browser with our responsive reader supporting appearance and font-size controls.
            </p>
          </div>

          <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 space-y-4 relative">
            <div className="w-10 h-10 rounded-xl bg-[#FFF3F4] dark:bg-[#E43136]/15 text-[#E43136] font-display font-bold text-base flex items-center justify-center">
              02
            </div>
            <h3 className="font-display text-lg font-bold text-[#202020] dark:text-[#F5F5F7]">
              Write &amp; Publish
            </h3>
            <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] leading-relaxed">
              Draft chapters, upload manuscripts, and share your voice. Authors retain complete ownership of their books with real-time reader engagement metrics.
            </p>
          </div>

          <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 space-y-4 relative">
            <div className="w-10 h-10 rounded-xl bg-[#FFF3F4] dark:bg-[#E43136]/15 text-[#E43136] font-display font-bold text-base flex items-center justify-center">
              03
            </div>
            <h3 className="font-display text-lg font-bold text-[#202020] dark:text-[#F5F5F7]">
              Connect &amp; Co-Read
            </h3>
            <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] leading-relaxed">
              Invite friends to turn pages together. Chat, discuss plot twists in real time, and join reading groups built around the books you love.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. FEATURED BOOKS (Real Published Content from Firestore)
      ===================================================================== */}
      {featuredBooks.length > 0 && (
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-[#E43136] uppercase tracking-wider">
                Explore The Library
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#202020] dark:text-[#F5F5F7]">
                Featured Published Books
              </h2>
            </div>
            <Link
              to="/explore"
              className="text-xs font-semibold text-[#E43136] hover:underline inline-flex items-center gap-1 self-start sm:self-auto"
            >
              <span>View All Books</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {featuredBooks.map((book) => (
              <Link
                key={book.id}
                to={`/book/${book.id}`}
                className="group flex flex-col space-y-2 bg-white dark:bg-[#16161A] p-2.5 rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] hover:border-[#E43136]/40 transition-all hover:shadow-md"
              >
                <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 relative">
                  <BookCover
                    book={book}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {book.category && (
                    <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-white text-[9px] font-semibold">
                      {book.category}
                    </span>
                  )}
                </div>
                <div className="space-y-0.5 flex-1 flex flex-col justify-between">
                  <h3 className="text-xs font-bold text-[#202020] dark:text-[#F5F5F7] line-clamp-1 group-hover:text-[#E43136] transition-colors">
                    {book.title}
                  </h3>
                  <p className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8] line-clamp-1">
                    {book.authorName}
                  </p>
                  <div className="flex items-center gap-2 pt-1 text-[10px] text-[#8E8E98]">
                    <span className="flex items-center gap-0.5">
                      <Heart className="w-3 h-3 text-[#E43136]" /> {book.likes || 0}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Eye className="w-3 h-3" /> {book.views || 0}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* =====================================================================
          4. PUBLISHING BENEFITS & INDIE CREATORS
      ===================================================================== */}
      <section className="bg-gradient-to-br from-[#FFF3F4] to-white dark:from-[#1E1215] dark:to-[#16161A] rounded-3xl p-6 sm:p-10 border border-[#E43136]/20 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 space-y-4">
          <span className="text-xs font-bold text-[#E43136] uppercase tracking-wider">
            For Authors &amp; Storytellers
          </span>
          <h2 className="font-display text-2xl sm:text-4xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            Publish Your Stories Directly to Readers
          </h2>
          <p className="text-xs sm:text-sm text-[#6E6E77] dark:text-[#9E9EA8] leading-relaxed">
            Whether you are writing your first short story, serializing a fantasy epic, or sharing essays, Redcover provides a clean publishing studio.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            <div className="flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 text-[#E43136]" />
              <span>Full copyright ownership retention</span>
            </div>
            <div className="flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 text-[#E43136]" />
              <span>Direct reader feedback on chapters</span>
            </div>
            <div className="flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 text-[#E43136]" />
              <span>Chapter-by-chapter publishing</span>
            </div>
            <div className="flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 text-[#E43136]" />
              <span>Real-time views and likes tracking</span>
            </div>
          </div>
        </div>
        <div className="lg:col-span-5 flex justify-center">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#1E1E26] border border-[#DDDDE3] dark:border-[#2C2C35] shadow-lg text-center space-y-3 max-w-sm w-full">
            <div className="w-12 h-12 rounded-2xl bg-[#E43136]/10 text-[#E43136] flex items-center justify-center mx-auto">
              <Feather className="w-6 h-6" />
            </div>
            <h3 className="font-display text-lg font-bold text-[#202020] dark:text-[#F5F5F7]">
              Start Writing Today
            </h3>
            <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8]">
              No fees, no exclusivity clauses. Publish freely and connect with your reading audience.
            </p>
            <button
              type="button"
              onClick={handleGoogleAuth}
              className="w-full py-2.5 px-4 rounded-xl bg-[#E43136] hover:bg-[#B9272D] text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              Continue with Google
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. FREQUENTLY ASKED QUESTIONS (Interactive Accordion)
      ===================================================================== */}
      <section className="space-y-6 max-w-3xl mx-auto">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold text-[#E43136] uppercase tracking-wider">
            Clear Answers
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#202020] dark:text-[#F5F5F7]">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={faq.q}
                className="rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#16161A] overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 text-left font-display text-xs sm:text-sm font-bold text-[#202020] dark:text-[#F5F5F7] cursor-pointer"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#E43136] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#8E8E98] shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-4 pb-5 sm:px-5 sm:pb-5 text-xs text-[#6E6E77] dark:text-[#9E9EA8] leading-relaxed border-t border-[#F1F1F4] dark:border-[#22222A] pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          6. FINAL CALL TO ACTION
      ===================================================================== */}
      <section className="text-center rounded-3xl bg-gradient-to-b from-[#1C1C24] to-[#0A0A0E] text-white p-8 sm:p-14 space-y-5 border border-white/10 shadow-xl">
        <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight">
          Ready to Step Into the Next Chapter of Reading?
        </h2>
        <p className="text-xs sm:text-sm text-gray-300 max-w-xl mx-auto leading-relaxed">
          Join thousands of readers, writers, and book enthusiasts on Redcover. Discover original books or start co-reading with friends right now.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              void handleGoogleAuth();
            }}
            className="px-6 py-3 rounded-xl bg-[#E43136] hover:bg-[#B9272D] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-md"
          >
            Continue with Google
          </button>
          <Link
            to="/explore"
            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold transition-colors border border-white/20"
          >
            Explore Public Library
          </Link>
        </div>
      </section>
    </div>
  );
};
