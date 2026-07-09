import 'react-native-get-random-values';
import React from 'react';
import { AuthProvider } from './providers/AuthProvider';
import { AppNavigation } from './navigation';
import { setCryptoProvider, MobileCryptoProvider } from '@akshar/crypto';
import { Buffer } from 'buffer';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Polyfill TextEncoder and TextDecoder for Hermes if missing
// (We now use robust utils in @akshar/crypto to avoid dependency on global TextDecoder)

// Initialize the cryptographic primitives for the mobile platform
setCryptoProvider(new MobileCryptoProvider());

export default function App() {
  return (
    <AuthProvider>
      <AppNavigation />
    </AuthProvider>
  );
}
