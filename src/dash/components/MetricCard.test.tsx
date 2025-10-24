import React from 'react';
import { render, screen } from '@testing-library/react';
import { MetricCard } from './MetricCard';

describe('MetricCard', () => {
  it('should render title and value', () => {
    render(<MetricCard title="Total PnL" value="$1,000" />);

    expect(screen.getByText('Total PnL')).toBeInTheDocument();
    expect(screen.getByText('$1,000')).toBeInTheDocument();
  });

  it('should render numeric value with locale formatting', () => {
    render(<MetricCard title="Total Trades" value={1234567} />);

    expect(screen.getByText('Total Trades')).toBeInTheDocument();
    expect(screen.getByText('1,234,567')).toBeInTheDocument();
  });

  it('should render subtitle when provided', () => {
    render(
      <MetricCard
        title="Open Positions"
        value={5}
        subtitle="2 closed"
      />
    );

    expect(screen.getByText('2 closed')).toBeInTheDocument();
  });

  it('should apply green color for up trend', () => {
    const { container } = render(
      <MetricCard title="PnL" value="$500" trend="up" />
    );

    const valueElement = container.querySelector('.text-green');
    expect(valueElement).toBeInTheDocument();
  });

  it('should apply red color for down trend', () => {
    const { container } = render(
      <MetricCard title="PnL" value="-$200" trend="down" />
    );

    const valueElement = container.querySelector('.text-red');
    expect(valueElement).toBeInTheDocument();
  });

  it('should apply gray color for neutral trend', () => {
    const { container } = render(
      <MetricCard title="Status" value="Idle" trend="neutral" />
    );

    const valueElement = container.querySelector('.text-gray');
    expect(valueElement).toBeInTheDocument();
  });

  it('should default to neutral trend when not specified', () => {
    const { container } = render(
      <MetricCard title="Test" value="Value" />
    );

    const valueElement = container.querySelector('.text-gray');
    expect(valueElement).toBeInTheDocument();
  });

  it('should render icon when provided', () => {
    const TestIcon = () => <span data-testid="test-icon">$</span>;

    render(
      <MetricCard
        title="Revenue"
        value="$1000"
        icon={<TestIcon />}
      />
    );

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('should apply custom className when provided', () => {
    const { container } = render(
      <MetricCard
        title="Test"
        value="Value"
        className="custom-class"
      />
    );

    const card = container.querySelector('.custom-class');
    expect(card).toBeInTheDocument();
  });
});
