/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RedcoverProvider } from './contexts/RedcoverContext';
import { AppLayout } from './components/layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { ExplorePage, SearchPage } from './pages/ExploreAndSearchPage';
import { BookDetailsPage, ReaderPage } from './pages/BookDetailsAndReaderPage';
import { HubPage } from './pages/HubPage';
import { CreateBookPage } from './pages/CreateBookPage';
import {
  ProfilePage,
  NotificationsPage,
  MembershipPage,
  SettingsPage,
  AdminPage,
  AuthPage,
} from './pages/AccountAndAdminPages';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsPage } from './pages/TermsPage';
import { CommunityGuidelinesPage } from './pages/CommunityGuidelinesPage';
import { CopyrightPolicyPage } from './pages/CopyrightPolicyPage';

export default function App() {
  return (
    <RedcoverProvider>
      <BrowserRouter>
        <AppLayout>
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
        </AppLayout>
      </BrowserRouter>
    </RedcoverProvider>
  );
}
