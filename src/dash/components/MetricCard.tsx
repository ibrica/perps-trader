import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend = 'neutral',
  icon,
  className = '',
}: MetricCardProps) {
  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green';
      case 'down':
        return 'text-red';
      default:
        return 'text-gray';
    }
  };

  return (
    <div className={`card ${className}`}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h3 className="text-gray mb-2">{title}</h3>
          <div className={`text-2xl font-bold ${getTrendColor()}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          {subtitle && (
            <p className="text-gray text-sm" style={{ marginTop: '0.5rem' }}>
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className="text-gray" style={{ fontSize: '2rem' }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
