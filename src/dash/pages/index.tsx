import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  getDashboardAnalytics,
  getPositions,
  getPerps,
  getSettings,
  clearAuthToken,
} from '../services/api';
import {
  DashboardAnalytics,
  Position,
  Perp,
  Settings,
  TimePeriod,
  TradePositionStatus,
} from '../types/dashboard';
import { MetricCard } from '../components/MetricCard';
import { ProfitChart } from '../components/ProfitChart';
import { PositionsTable } from '../components/PositionsTable';
import { PerpsTable } from '../components/PerpsTable';
import { SettingsPanel } from '../components/SettingsPanel';
import {
  TrendingUp,
  DollarSign,
  Activity,
  BarChart3,
  LogOut,
} from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [perps, setPerps] = useState<Perp[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<TimePeriod>(TimePeriod.LAST_30_DAYS);
  const [positionStatus, setPositionStatus] = useState<
    TradePositionStatus | undefined
  >(TradePositionStatus.OPEN);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'positions' | 'perps' | 'settings'
  >('overview');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [analyticsData, positionsData, perpsData, settingsData] =
        await Promise.all([
          getDashboardAnalytics({ period }),
          getPositions(positionStatus, 100, 0),
          getPerps(),
          getSettings(),
        ]);

      setAnalytics(analyticsData);
      setPositions(positionsData.positions);
      setPerps(perpsData);
      setSettings(settingsData);
    } catch (err: any) {
      console.error('Failed to fetch data:', err);
      setError(err.message || 'Failed to load dashboard data');

      if (err.status === 401) {
        clearAuthToken();
        const backendUrl =
          process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7777';
        window.location.href = `${backendUrl}/api/auth/google`;
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period, positionStatus]);

  const handleLogout = () => {
    clearAuthToken();
    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7777';
    window.location.href = `${backendUrl}/api/auth/google`;
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="card" style={{ backgroundColor: '#fee2e2' }}>
          <h2 className="text-xl font-bold text-red mb-2">Error</h2>
          <p>{error}</p>
          <button
            className="btn btn-primary"
            onClick={fetchData}
            style={{ marginTop: '1rem' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <h1 className="text-3xl font-bold">Perps Trader Dashboard</h1>
        <button
          className="btn btn-secondary"
          onClick={handleLogout}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem',
          borderBottom: '2px solid #e5e7eb',
        }}
      >
        {(['overview', 'positions', 'perps', 'settings'] as const).map(
          (tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: 'none',
                borderBottom:
                  activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
                color: activeTab === tab ? '#3b82f6' : '#6b7280',
                fontWeight: activeTab === tab ? 600 : 400,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          ),
        )}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && analytics && (
        <>
          {/* Period Selector */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="period" style={{ marginRight: '0.5rem' }}>
              Time Period:
            </label>
            <select
              id="period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as TimePeriod)}
              style={{ padding: '0.5rem' }}
            >
              <option value={TimePeriod.LAST_7_DAYS}>Last 7 Days</option>
              <option value={TimePeriod.LAST_30_DAYS}>Last 30 Days</option>
              <option value={TimePeriod.LAST_3_MONTHS}>Last 3 Months</option>
              <option value={TimePeriod.LAST_6_MONTHS}>Last 6 Months</option>
              <option value={TimePeriod.LAST_YEAR}>Last Year</option>
            </select>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-4">
            <MetricCard
              title="Total PnL"
              value={`$${analytics.overview.totalPnl.toFixed(2)}`}
              trend={analytics.overview.totalPnl > 0 ? 'up' : 'down'}
              icon={<DollarSign />}
            />
            <MetricCard
              title="Win Rate"
              value={`${analytics.overview.winRate.toFixed(1)}%`}
              trend={
                analytics.overview.winRate > 50
                  ? 'up'
                  : analytics.overview.winRate < 50
                    ? 'down'
                    : 'neutral'
              }
              icon={<TrendingUp />}
            />
            <MetricCard
              title="Open Positions"
              value={analytics.overview.openPositionsCount}
              subtitle={`${analytics.overview.closedPositionsCount} closed`}
              icon={<Activity />}
            />
            <MetricCard
              title="Total Trades"
              value={analytics.overview.totalTrades}
              subtitle={`$${analytics.overview.totalVolume.toFixed(2)} volume`}
              icon={<BarChart3 />}
            />
          </div>

          {/* Chart */}
          <ProfitChart data={analytics.timeSeries} />

          {/* Token Breakdown */}
          <div className="card">
            <h3 className="text-xl font-semibold mb-4">
              Top Tokens by Performance
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Total PnL</th>
                    <th>Win Rate</th>
                    <th>Trades</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.tokenBreakdown.slice(0, 10).map((token) => (
                    <tr key={token.token}>
                      <td className="font-semibold">{token.token}</td>
                      <td
                        className={
                          token.totalPnl > 0 ? 'text-green' : 'text-red'
                        }
                      >
                        ${token.totalPnl.toFixed(2)}
                      </td>
                      <td>{token.winRate.toFixed(1)}%</td>
                      <td>{token.tradeCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Positions Tab */}
      {activeTab === 'positions' && (
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
            }}
          >
            <h3 className="text-xl font-semibold">Positions</h3>
            <select
              value={positionStatus || ''}
              onChange={(e) =>
                setPositionStatus(
                  e.target.value
                    ? (e.target.value as TradePositionStatus)
                    : undefined,
                )
              }
              style={{ padding: '0.5rem' }}
            >
              <option value="">All Statuses</option>
              <option value={TradePositionStatus.OPEN}>Open</option>
              <option value={TradePositionStatus.CLOSED}>Closed</option>
              <option value={TradePositionStatus.FAILED}>Failed</option>
            </select>
          </div>
          <PositionsTable positions={positions} onUpdate={fetchData} />
        </div>
      )}

      {/* Perps Tab */}
      {activeTab === 'perps' && (
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Perpetual Contracts Configuration</h3>
          <PerpsTable perps={perps} onUpdate={fetchData} />
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && settings && (
        <SettingsPanel settings={settings} onUpdate={fetchData} />
      )}
    </div>
  );
}
