import React, { useState } from 'react';
import { Position, TradePositionStatus } from '../types/dashboard';
import { updatePositionExitFlag } from '../services/api';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

interface PositionsTableProps {
  positions: Position[];
  onUpdate?: () => void;
  pagination?: PaginationProps;
}

export function PositionsTable({ positions, onUpdate, pagination }: PositionsTableProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleExitFlagToggle = async (position: Position) => {
    try {
      setLoading(position.id);
      await updatePositionExitFlag(position.id, !position.exitFlag);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to update position:', error);
      alert('Failed to update position. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return 'N/A';
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number | undefined) => {
    if (value === undefined) return 'N/A';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const getStatusBadge = (status: TradePositionStatus) => {
    switch (status) {
      case TradePositionStatus.OPEN:
        return <span className="badge badge-green">OPEN</span>;
      case TradePositionStatus.CLOSED:
        return <span className="badge badge-gray">CLOSED</span>;
      default:
        return <span className="badge badge-red">FAILED</span>;
    }
  };

  const getPnlColor = (pnl: number | undefined) => {
    if (!pnl) return 'text-gray';
    return pnl > 0 ? 'text-green' : 'text-red';
  };

  const renderPagination = () => {
    if (!pagination || pagination.totalPages <= 1) return null;

    const { currentPage, totalPages, totalItems, itemsPerPage, onPageChange } = pagination;

    // Calculate the range of items being displayed
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    // Generate page numbers to display
    const getPageNumbers = () => {
      const pages: (number | string)[] = [];
      const maxVisible = 7; // Maximum number of page buttons to show

      if (totalPages <= maxVisible) {
        // Show all pages if total is small
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Always show first page
        pages.push(1);

        if (currentPage > 3) {
          pages.push('...');
        }

        // Show pages around current page
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        for (let i = start; i <= end; i++) {
          pages.push(i);
        }

        if (currentPage < totalPages - 2) {
          pages.push('...');
        }

        // Always show last page
        pages.push(totalPages);
      }

      return pages;
    };

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '1rem',
          padding: '1rem 0',
          borderTop: '1px solid #e5e7eb',
        }}
      >
        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          Showing {startItem}-{endItem} of {totalItems} positions
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              opacity: currentPage === 1 ? 0.5 : 1,
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            }}
          >
            Previous
          </button>
          {getPageNumbers().map((page, index) => (
            typeof page === 'number' ? (
              <button
                key={index}
                className={`btn ${page === currentPage ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onPageChange(page)}
                style={{
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  minWidth: '2.5rem',
                }}
              >
                {page}
              </button>
            ) : (
              <span key={index} style={{ padding: '0 0.25rem', color: '#6b7280' }}>
                {page}
              </span>
            )
          ))}
          <button
            className="btn btn-secondary"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              opacity: currentPage === totalPages ? 0.5 : 1,
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Status</th>
              <th>Direction</th>
              <th>Entry Price</th>
              <th>Current Price</th>
              <th>PnL</th>
              <th>PnL %</th>
              <th>Leverage</th>
              <th>Opened</th>
              <th>Exit Flag</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '2rem' }}>
                  No positions found
                </td>
              </tr>
            ) : (
              positions.map((position) => (
                <tr key={position.id}>
                  <td className="font-semibold">{position.token}</td>
                  <td>{getStatusBadge(position.status)}</td>
                  <td>
                    <span
                      className={
                        position.positionDirection === 'LONG'
                          ? 'text-green'
                          : 'text-red'
                      }
                    >
                      {position.positionDirection || 'N/A'}
                    </span>
                  </td>
                  <td>{formatCurrency(position.entryPrice)}</td>
                  <td>{formatCurrency(position.currentPrice)}</td>
                  <td className={getPnlColor(position.realizedPnl)}>
                    {formatCurrency(position.realizedPnl)}
                  </td>
                  <td className={getPnlColor(position.pnlPercent)}>
                    {formatPercent(position.pnlPercent)}
                  </td>
                  <td>{position.leverage ? `${position.leverage}x` : 'N/A'}</td>
                  <td className="text-sm">{formatDate(position.timeOpened)}</td>
                  <td>
                    {position.status === TradePositionStatus.OPEN && (
                      <button
                        className={`btn ${position.exitFlag ? 'btn-danger' : 'btn-secondary'}`}
                        onClick={() => handleExitFlagToggle(position)}
                        disabled={loading === position.id}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                      >
                        {loading === position.id
                          ? 'Updating...'
                          : position.exitFlag
                            ? 'Exit Marked'
                            : 'Mark Exit'}
                      </button>
                    )}
                    {position.status !== TradePositionStatus.OPEN && (
                      <span className="text-gray">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {renderPagination()}
    </div>
  );
}
