import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    if (router.isReady) {
      router.replace('/');
    }
  }, [router]);

  return (
    <div className="container">
      <div style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '1rem' }}>Completing authentication...</p>
      </div>
    </div>
  );
}
