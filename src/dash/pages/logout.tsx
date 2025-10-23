import React, { useEffect, useState } from 'react';
import { clearAuthToken } from '../services/api';

export default function Logout() {
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // Clear token from localStorage using the correct function
    clearAuthToken();

    // Also call the backend logout endpoint
    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7777';
    fetch(`${backendUrl}/api/auth/logout`, {
      credentials: 'include', // Include cookies if any
    }).catch(() => {
      // Ignore errors - logout is client-side for JWT
    });
  }, []);

  const handleLogin = () => {
    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7777';
    window.location.href = `${backendUrl}/api/auth/google`;
  };

  const handleGoogleLogout = () => {
    // Open Google account logout in new tab
    window.open('https://accounts.google.com/Logout', '_blank');
    setShowInstructions(true);
  };

  return (
    <div className="container">
      <div
        className="card"
        style={{
          maxWidth: '600px',
          margin: '4rem auto',
          textAlign: 'center',
        }}
      >
        <h1 className="text-3xl font-bold mb-4">Logged Out</h1>
        <p style={{ marginBottom: '2rem', color: '#6b7280' }}>
          You have been successfully logged out of Perps Trader Dashboard.
        </p>

        {showInstructions && (
          <div
            style={{
              backgroundColor: '#f3f4f6',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              textAlign: 'left',
            }}
          >
            <p style={{ fontSize: '0.875rem', color: '#374151' }}>
              <strong>Note:</strong> If you want to prevent automatic re-login when
              opening the dashboard again, please log out of your Google account
              in the opened tab.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={handleLogin}>
            Login Again
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleGoogleLogout}
          >
            Also Logout of Google
          </button>
        </div>
      </div>
    </div>
  );
}
