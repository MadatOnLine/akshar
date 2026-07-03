/**
 * Akshar Mobile App — Root component with providers.
 */
import React from 'react';
import { AuthProvider } from './providers/AuthProvider';
import { AppNavigation } from './navigation';

export default function App() {
  return (
    <AuthProvider>
      <AppNavigation />
    </AuthProvider>
  );
}
