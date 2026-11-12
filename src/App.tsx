/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RedcoverProvider } from './contexts/RedcoverContext';
import { AppLayout } from './components/layout/AppLayout';

const HomePage = React.lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const ExplorePage = React.lazy(() => import('./pages/ExploreAndSearchPage').then((m) => ({ default: m.ExplorePage })));
const SearchPage = React.lazy(() => import('./pages/ExploreAndSearchPage').then((m) => ({ default: m.SearchPage })));
const BookDetailsPage = React.lazy(() => import('./pages/BookDetailsAndReaderPage').then((m) => ({ default: m.BookDetailsPage })));
const ReaderPage = React.lazy(() => import('./pages/BookDetailsAndReaderPage').then((m) => ({ default: m.ReaderPage })));
const HubPage = React.lazy(() => import('./pages/HubPage').then((m) => ({ default: m.HubPage })));
const CreateBookPage = React.lazy(() => import('./pages/CreateBookPage').then((m) => ({ default: m.CreateBookPage })));
const ProfilePage = React.lazy(() => import('./pages/AccountAndAdminPages').then((m) => ({ default: m.ProfilePage })));
const NotificationsPage = React.lazy(() => import('./pages/AccountAndAdminPages').then((m) => ({ default: m.NotificationsPage })));
const SettingsPage = React.lazy(() => import('./pages/AccountAndAdminPages').then((m) => ({ default: m.SettingsPage })));
const AdminPage = React.lazy(() => import('./pages/AccountAndAdminPages').then((m) => ({ default: m.AdminPage })));
const AuthPage = React.lazy(() => import('./pages/AccountAndAdminPages').then((m) => ({ default: m.AuthPage })));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const AboutPage = React.lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const ContactPage = React.lazy(() => import('./pages/ContactPage').then((m) => ({ default: m.ContactPage })));
const PrivacyPolicyPage = React.lazy(() => import('./pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })));
const TermsPage = React.lazy(() => import('./pages/TermsPage').then((m) => ({ default: m.TermsPage })));
const CommunityGuidelinesPage = React.lazy(() => import('./pages/CommunityGuidelinesPage').then((m) => ({ default: m.CommunityGuidelinesPage })));
const CopyrightPolicyPage = React.lazy(() => import('./pages/CopyrightPolicyPage').then((m) => ({ default: m.CopyrightPolicyPage })));

export default function App() {
  return (
    <RedcoverProvider>
      <BrowserRouter>
        <AppLayout>
          <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center text-sm text-[#6E6E77]">Loading Redcover…</div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/community-guidelines" element={<CommunityGuidelinesPage />} />
            <Route path="/copyright" element={<CopyrightPolicyPage />} />
            <Route path="/book/:bookId" element={<BookDetailsPage />} />
            <Route path="/read/:bookId" element={<ReaderPage />} />
            <Route path="/hub" element={<Navigate to="/hub/chats" replace />} />
            <Route path="/hub/*" element={<HubPage />} />
            <Route path="/create" element={<CreateBookPage />} />
            <Route path="/profile/:userId" element={<ProfilePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/membership" element={<Navigate to="/settings" replace />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </AppLayout>
      </BrowserRouter>
    </RedcoverProvider>
  );
}
