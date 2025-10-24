import React, { useState } from 'react';
import { Settings } from '../types/dashboard';
import { updateSettings } from '../services/api';

interface SettingsPanelProps {
  settings: Settings;
  onUpdate?: () => void;
}

export function SettingsPanel({ settings, onUpdate }: SettingsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleToggle = async () => {
    if (!settings.closeAllPositions && !showConfirm) {
      setShowConfirm(true);
      return;
    }

    try {
      setLoading(true);
      await updateSettings(!settings.closeAllPositions);
      if (onUpdate) onUpdate();
      setShowConfirm(false);
    } catch (error) {
      console.error('Failed to update settings:', error);
      alert('Failed to update settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3 className="text-xl font-semibold mb-4">Trading Control</h3>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem',
          backgroundColor: settings.closeAllPositions ? '#fee2e2' : '#f3f4f6',
          borderRadius: '8px',
        }}
      >
        <div>
          <h4 className="font-semibold mb-2">Close All Positions</h4>
          <p className="text-sm text-gray">
            {settings.closeAllPositions
              ? 'Trading is currently HALTED. All positions will be closed.'
              : 'Trading is active. Toggle to halt trading and close all positions.'}
          </p>
        </div>

        <button
          className={`btn ${settings.closeAllPositions ? 'btn-success' : 'btn-danger'}`}
          onClick={handleToggle}
          disabled={loading}
          style={{ minWidth: '120px' }}
        >
          {loading
            ? 'Updating...'
            : settings.closeAllPositions
              ? 'Resume Trading'
              : 'Halt Trading'}
        </button>
      </div>

      {showConfirm && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            border: '2px solid #f59e0b',
          }}
        >
          <h4 className="font-semibold mb-2">⚠️ Confirm Action</h4>
          <p className="text-sm mb-4">
            Are you sure you want to halt trading and close all positions? This
            action will:
          </p>
          <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem' }}>
            <li className="text-sm">Stop opening new positions</li>
            <li className="text-sm">
              Close all currently open positions at market price
            </li>
          </ul>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-danger"
              onClick={handleToggle}
              disabled={loading}
            >
              Yes, Halt Trading
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowConfirm(false)}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
        <p className="text-sm text-gray">
          <strong>Last Updated:</strong>{' '}
          {new Date(settings.updatedAt || '').toLocaleString()}
        </p>
      </div>
    </div>
  );
}
