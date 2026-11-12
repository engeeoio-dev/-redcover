import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Mail, BookOpen, ShieldCheck, Heart, Sparkles, Feather } from 'lucide-react';
import { useHqBranding } from '../../hooks/useHqBranding';

export const PublicFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const activeBrandCampaign = useHqBranding();

  return (
    <footer className="w-full bg-white dark:bg-[#0A0A0D] border-t border-[#DDDDE3] dark:border-[#22222A] mt-auto transition-colors">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Main 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
          {/* Column 1 & 2: Brand Identity */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <img
                src={activeBrandCampaign?.logoUrl || '/assets/aistudio/WhatsApp_Image_2026-10-24_at_6.29.36_PM_8a2e5d20.jpeg'}
                alt={activeBrandCampaign?.name || 'Redcover'}
                className="w-8 h-8 rounded-lg object-cover shadow-xs"
              />
              <span className="font-display text-xl font-bold tracking-tight text-[#E43136]">
                Redcover
              </span>
            </Link>

            <p className="text-xs sm:text-sm text-[#6E6E77] dark:text-[#9E9EA8] max-w-sm leading-relaxed">
              Read. Write. Publish. Connect. Co-Read.
              <br />
              A social reading and publishing platform bringing together readers, authors and creative book communities.
            </p>

            {/* Founder Credit Pill */}
            <div className="inline-flex items-center gap-3 p-2.5 rounded-xl bg-[#FAFAFB] dark:bg-[#121217] border border-[#DDDDE3] dark:border-[#22222A]">
              <div className="w-9 h-9 rounded-full bg-[#E43136]/10 text-[#E43136] font-bold text-xs flex items-center justify-center shrink-0">
                MK
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-[#202020] dark:text-[#F5F5F7] leading-tight">
                  Muzammil Khan
                </p>
                <p className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8]">
                  Founder & CEO • AI & Data Science
                </p>
              </div>
            </div>

            {/* Social & Contact Links */}
            <div className="flex items-center gap-3 pt-1">
              <a
                href="https://www.instagram.com/redcover.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-[#F1F1F4] dark:bg-[#16161D] text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#E43136] hover:bg-[#FFF3F4] dark:hover:bg-[#E43136]/10 transition-colors inline-flex items-center gap-1.5 text-xs font-medium"
                title="Follow Redcover on Instagram"
              >
                <Instagram className="w-4 h-4 text-[#E43136]" />
                <span>@redcover.app</span>
              </a>
              <a
                href="mailto:engeeo.io@gmail.com"
                className="p-2 rounded-lg bg-[#F1F1F4] dark:bg-[#16161D] text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#E43136] hover:bg-[#FFF3F4] dark:hover:bg-[#E43136]/10 transition-colors inline-flex items-center gap-1.5 text-xs font-medium"
                title="Email Redcover Support"
              >
                <Mail className="w-4 h-4 text-[#E43136]" />
                <span>engeeo.io@gmail.com</span>
              </a>
            </div>
          </div>

          {/* Column 3: Platform Navigation */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#202020] dark:text-[#F5F5F7]">
              Platform
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  to="/"
                  className="text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#E43136] transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/explore"
                  className="text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#E43136] transition-colors"
                >
                  Explore Books
                </Link>
              </li>
              <li>
                <Link
                  to="/create"
                  className="text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#E43136] transition-colors"
                >
                  Write & Publish
                </Link>
              </li>
              <li>
                <Link
                  to="/hub"
                  className="text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#E43136] transition-colors"
                >
                  Reader Hub & Chats
                </Link>
              </li>
              <li>
                <Link
                  to="/search"
                  className="text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#E43136] transition-colors"
                >
                  Search Catalog
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: About & Support */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#202020] dark:text-[#F5F5F7]">
              Company
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  to="/about"
                  className="text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#E43136] transition-colors"
                >
                  About Redcover
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#E43136] transition-colors"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link
                  to="/community-guidelines"
                  className="text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#E43136] transition-colors"
                >
                  Community Guidelines
                </Link>
              </li>
              <li>
                <Link
                  to="/copyright"
                  className="text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#E43136] transition-colors"
                >
                  Copyright Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 5: Legal & Privacy */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#202020] dark:text-[#F5F5F7]">
              Legal & Trust
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  to="/privacy"
                  className="text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#E43136] transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#E43136] transition-colors"
                >
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link
                  to="/copyright"
                  className="text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#E43136] transition-colors"
                >
                  Report Infringement
                </Link>
              </li>
              <li className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  India Operating Context
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & AdSense / Compliance Notice */}
        <div className="mt-10 pt-6 border-t border-[#DDDDE3] dark:border-[#22222A] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6E6E77] dark:text-[#9E9EA8]">
          <p>© {currentYear} Redcover (https://redcover.app). All rights reserved.</p>
          <p className="text-[11px] text-[#8E8E98] text-center sm:text-right">
            Redcover is an ad-supported and creator-centric social reading platform.
          </p>
        </div>
      </div>
    </footer>
  );
};
