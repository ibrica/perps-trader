import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { getAuthToken } from '../services/api';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    const token = getAuthToken();
    const publicPaths = ['/auth/callback', '/login'];
    const isPublicPath = publicPaths.includes(router.pathname);

    if (!token && !isPublicPath) {
      // Redirect to backend OAuth flow
      const backendUrl =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7777';
      window.location.href = `${backendUrl}/api/auth/google`;
    }
  }, [router.pathname]);

  return <Component {...pageProps} />;
}
