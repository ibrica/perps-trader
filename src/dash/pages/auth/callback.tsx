import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { setAuthToken } from '../../services/api';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const { token } = router.query;

    if (token && typeof token === 'string') {
      setAuthToken(token);
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
