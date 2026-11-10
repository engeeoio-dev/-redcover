import React from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Feather,
  Users,
  Compass,
  Sparkles,
  Heart,
  ShieldCheck,
  ArrowRight,
  Share2,
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-12 sm:space-y-16 py-6 sm:py-10">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF3F4] dark:bg-[#E43136]/15 text-[#E43136] text-xs font-bold uppercase tracking-wider">
          <BookOpen className="w-3.5 h-3.5" />
          About Redcover
        </span>
        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#202020] dark:text-[#F5F5F7] leading-tight">
          Read. Write. Publish. Connect. Co-Read.
        </h1>
        <p className="text-base sm:text-lg text-[#6E6E77] dark:text-[#9E9EA8] max-w-2xl mx-auto leading-relaxed">
          Redcover is a social reading and publishing platform created to bridge the gap between solitary reading and vibrant literary communities.
        </p>
      </div>

      {/* Hero Visual / Atmosphere Banner */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-[#DDDDE3] dark:border-[#22222A] shadow-md">
        <img
          src="/assets/hero-banner.jpg"
          alt="Redcover Social Reading Community"
          className="w-full h-64 sm:h-80 object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-end p-6 sm:p-8">
          <div className="text-white space-y-1 max-w-xl">
            <h2 className="text-lg sm:text-2xl font-bold">Making Reading a Shared Experience</h2>
            <p className="text-xs sm:text-sm text-gray-200">
              Discover stories, write original work, and invite your friends to read along with real-time synchronized turn-by-turn controls.
            </p>
          </div>
        </div>
      </div>

      {/* Core Mission */}
      <div className="bg-white dark:bg-[#16161A] rounded-2xl sm:rounded-3xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 sm:p-10 space-y-6">
        <h2 className="font-display text-2xl font-bold text-[#202020] dark:text-[#F5F5F7]">
          Our Story and Vision
        </h2>
        <div className="prose dark:prose-invert max-w-none text-sm sm:text-base text-[#4E4E56] dark:text-[#B0B0BC] leading-relaxed space-y-4">
          <p>
            For centuries, reading has been a solitary pastime. While personal reflection remains at the heart of literature, modern readers crave shared thoughts, thoughtful annotations, immediate reactions, and genuine companionship with others who love the same books.
          </p>
          <p>
            Redcover was born from this exact insight. Designed from the ground up as a combined social reading and independent publishing ecosystem, Redcover empowers authors to publish their original stories directly to an engaged community while granting readers an interactive space to discover books, discuss chapters, form reading circles, and co-read in real time.
          </p>
        </div>
      </div>

      {/* 4 Pillars of the Platform */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFF3F4] dark:bg-[#E43136]/15 text-[#E43136] flex items-center justify-center font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="font-display text-lg font-bold text-[#202020] dark:text-[#F5F5F7]">
            Universal Book Discovery
          </h3>
          <p className="text-xs sm:text-sm text-[#6E6E77] dark:text-[#9E9EA8] leading-relaxed">
            Explore curated genres, community uploads, and trending discussions. Read in a distraction-free, customizable digital reader with light and dark themes.
          </p>
        </div>

        <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFF3F4] dark:bg-[#E43136]/15 text-[#E43136] flex items-center justify-center font-bold">
            <Feather className="w-5 h-5" />
          </div>
          <h3 className="font-display text-lg font-bold text-[#202020] dark:text-[#F5F5F7]">
            Independent Publishing
          </h3>
          <p className="text-xs sm:text-sm text-[#6E6E77] dark:text-[#9E9EA8] leading-relaxed">
            Create, format, and publish your original stories or upload PDF manuscripts. Authors maintain full ownership of their work with comprehensive engagement stats.
          </p>
        </div>

        <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFF3F4] dark:bg-[#E43136]/15 text-[#E43136] flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-display text-lg font-bold text-[#202020] dark:text-[#F5F5F7]">
            Reading Hub & Groups
          </h3>
          <p className="text-xs sm:text-sm text-[#6E6E77] dark:text-[#9E9EA8] leading-relaxed">
            Connect with friends, start group chats around specific genres, share recommendations, and exchange chapter reviews with fellow book lovers.
          </p>
        </div>

        <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFF3F4] dark:bg-[#E43136]/15 text-[#E43136] flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="font-display text-lg font-bold text-[#202020] dark:text-[#F5F5F7]">
            Real-Time Co-Reading
          </h3>
          <p className="text-xs sm:text-sm text-[#6E6E77] dark:text-[#9E9EA8] leading-relaxed">
            Experience books together. Invite friends to a synchronized reading session where page turns, reading pace, and in-line discussions update live on both screens.
          </p>
        </div>
      </div>

      {/* Leadership & Founder Section */}
      <div className="bg-white dark:bg-[#16161A] rounded-2xl sm:rounded-3xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 sm:p-10 space-y-6">
        <span className="text-xs font-bold uppercase tracking-wider text-[#E43136]">
          Leadership
        </span>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-[#E43136] to-[#99151B] text-white flex items-center justify-center text-2xl font-bold shrink-0 shadow-md">
            MK
          </div>
          <div className="space-y-2">
            <h3 className="font-display text-xl sm:text-2xl font-bold text-[#202020] dark:text-[#F5F5F7]">
              Muzammil Khan
            </h3>
            <p className="text-xs sm:text-sm font-semibold text-[#E43136]">
              Founder & CEO • AI & Data Science
            </p>
            <p className="text-xs sm:text-sm text-[#6E6E77] dark:text-[#9E9EA8] leading-relaxed max-w-xl">
              Passionate about technology, algorithms, and digital literature. Muzammil founded Redcover with the ambition to build modern, community-driven reading software that brings people together across India and the global reading landscape.
            </p>
          </div>
        </div>
      </div>

      {/* Trust & Safety Commitment */}
      <div className="bg-[#FFF3F4] dark:bg-[#1E1215] border border-[#E43136]/20 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-[#E43136] uppercase tracking-wide">
            <ShieldCheck className="w-4 h-4" />
            <span>Integrity & Community Safety</span>
          </div>
          <h4 className="text-lg font-bold text-[#202020] dark:text-[#F5F5F7]">
            Built with respect for creators and readers
          </h4>
          <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] max-w-lg">
            We respect copyright and intellectual property. Authors retain their rights, and community guidelines are actively enforced for a respectful reading environment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            to="/community-guidelines"
            className="px-4 py-2 rounded-xl bg-white dark:bg-[#2A161A] text-[#202020] dark:text-white border border-[#DDDDE3] dark:border-[#4A2026] text-xs font-semibold hover:border-[#E43136] transition-colors"
          >
            Guidelines
          </Link>
          <Link
            to="/contact"
            className="px-4 py-2 rounded-xl bg-[#E43136] hover:bg-[#B9272D] text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <span>Get in Touch</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};
