import React, { useState } from 'react';
import { Perp } from '../types/dashboard';
import { updatePerp } from '../services/api';

interface PerpsTableProps {
  perps: Perp[];
  onUpdate?: () => void;
}

export function PerpsTable({ perps, onUpdate }: PerpsTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    recommendedAmount?: number;
    defaultLeverage?: number;
  }>({});
  const [loading, setLoading] = useState(false);

  const handleEdit = (perp: Perp) => {
    setEditingId(perp._id);
    setEditValues({
      recommendedAmount: perp.recommendedAmount,
      defaultLeverage: perp.defaultLeverage,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleSave = async (id: string) => {
    try {
      setLoading(true);
      await updatePerp(id, editValues);
      setEditingId(null);
      setEditValues({});
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to update perp:', error);
      alert('Failed to update perp. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Token</th>
            <th>Platform</th>
            <th>Active</th>
            <th>Buy Flag</th>
            <th>Market Direction</th>
            <th>Recommended Amount</th>
            <th>Default Leverage</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {perps.length === 0 ? (
            <tr>
              <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                No perps found
              </td>
            </tr>
          ) : (
            perps.map((perp) => (
              <tr key={perp._id}>
                <td className="font-semibold">{perp.name}</td>
                <td>{perp.token}</td>
                <td>{perp.platform}</td>
                <td>
                  <span
                    className={`badge ${perp.isActive ? 'badge-green' : 'badge-gray'}`}
                  >
                    {perp.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <span
                    className={`badge ${perp.buyFlag ? 'badge-green' : 'badge-gray'}`}
                  >
                    {perp.buyFlag ? 'Yes' : 'No'}
                  </span>
                </td>
                <td>
                  <span
                    className={`badge ${
                      perp.marketDirection === 'UP'
                        ? 'badge-green'
                        : perp.marketDirection === 'DOWN'
                          ? 'badge-red'
                          : 'badge-gray'
                    }`}
                  >
                    {perp.marketDirection}
                  </span>
                </td>
                <td>
                  {editingId === perp._id ? (
                    <input
                      type="number"
                      value={editValues.recommendedAmount || ''}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          recommendedAmount: parseFloat(e.target.value) || undefined,
                        })
                      }
                      style={{ width: '100px' }}
                      placeholder="Amount"
                    />
                  ) : (
                    `$${perp.recommendedAmount?.toFixed(2) || 'N/A'}`
                  )}
                </td>
                <td>
                  {editingId === perp._id ? (
                    <input
                      type="number"
                      value={editValues.defaultLeverage || ''}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          defaultLeverage: parseFloat(e.target.value) || undefined,
                        })
                      }
                      style={{ width: '80px' }}
                      placeholder="Leverage"
                    />
                  ) : (
                    `${perp.defaultLeverage || 1}x`
                  )}
                </td>
                <td>
                  {editingId === perp._id ? (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-success"
                        onClick={() => handleSave(perp._id)}
                        disabled={loading}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                      >
                        {loading ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={handleCancel}
                        disabled={loading}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleEdit(perp)}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
