import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { hasAuthSession } from '../services/api';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    const publicPaths = ['/auth/callback', '/login', '/logout'];
    const isPublicPath = publicPaths.includes(router.pathname);

    if (!isPublicPath && !hasAuthSession()) {
      // Redirect to backend OAuth flow
      const backendUrl =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7777';
      window.location.href = `${backendUrl}/api/auth/google`;
    }
  }, [router.pathname]);

  return <Component {...pageProps} />;
}
