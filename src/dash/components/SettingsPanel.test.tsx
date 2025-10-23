import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPanel } from './SettingsPanel';
import * as api from '../services/api';

// Mock the API module
jest.mock('../services/api');

describe('SettingsPanel', () => {
  const mockSettings = {
    _id: '123',
    closeAllPositions: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  const mockOnUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render settings panel with current state', () => {
    render(<SettingsPanel settings={mockSettings} />);

    expect(screen.getByText('Trading Control')).toBeInTheDocument();
    expect(screen.getByText('Close All Positions')).toBeInTheDocument();
    expect(
      screen.getByText(/Trading is active/)
    ).toBeInTheDocument();
  });

  it('should show halt trading button when trading is active', () => {
    render(<SettingsPanel settings={mockSettings} />);

    expect(screen.getByText('Halt Trading')).toBeInTheDocument();
  });

  it('should show resume trading button when trading is halted', () => {
    const haltedSettings = { ...mockSettings, closeAllPositions: true };
    render(<SettingsPanel settings={haltedSettings} />);

    expect(screen.getByText('Resume Trading')).toBeInTheDocument();
  });

  it('should show confirmation dialog when halting trading', () => {
    render(<SettingsPanel settings={mockSettings} onUpdate={mockOnUpdate} />);

    const haltButton = screen.getByText('Halt Trading');
    fireEvent.click(haltButton);

    expect(screen.getByText('⚠️ Confirm Action')).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to halt trading/)
    ).toBeInTheDocument();
  });

  it('should call updateSettings when confirming halt', async () => {
    const updatedSettings = { ...mockSettings, closeAllPositions: true };
    (api.updateSettings as jest.Mock).mockResolvedValue(updatedSettings);

    render(<SettingsPanel settings={mockSettings} onUpdate={mockOnUpdate} />);

    // Click halt button
    const haltButton = screen.getByText('Halt Trading');
    fireEvent.click(haltButton);

    // Confirm action
    const confirmButton = screen.getByText('Yes, Halt Trading');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(api.updateSettings).toHaveBeenCalledWith(true);
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  it('should resume trading without confirmation', async () => {
    const haltedSettings = { ...mockSettings, closeAllPositions: true };
    const updatedSettings = { ...mockSettings, closeAllPositions: false };
    (api.updateSettings as jest.Mock).mockResolvedValue(updatedSettings);

    render(<SettingsPanel settings={haltedSettings} onUpdate={mockOnUpdate} />);

    const resumeButton = screen.getByText('Resume Trading');
    fireEvent.click(resumeButton);

    await waitFor(() => {
      expect(api.updateSettings).toHaveBeenCalledWith(false);
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  it('should cancel halt when clicking cancel', () => {
    render(<SettingsPanel settings={mockSettings} onUpdate={mockOnUpdate} />);

    // Show confirmation
    const haltButton = screen.getByText('Halt Trading');
    fireEvent.click(haltButton);

    expect(screen.getByText('⚠️ Confirm Action')).toBeInTheDocument();

    // Cancel
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    // Confirmation dialog should be gone
    expect(screen.queryByText('⚠️ Confirm Action')).not.toBeInTheDocument();
    expect(api.updateSettings).not.toHaveBeenCalled();
  });

  it('should show error message when update fails', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
    (api.updateSettings as jest.Mock).mockRejectedValue(new Error('API Error'));

    render(<SettingsPanel settings={mockSettings} onUpdate={mockOnUpdate} />);

    const resumeButton = screen.getByText('Halt Trading');
    fireEvent.click(resumeButton);

    const confirmButton = screen.getByText('Yes, Halt Trading');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Failed to update settings. Please try again.'
      );
    });

    alertSpy.mockRestore();
  });

  it('should show loading state during update', async () => {
    (api.updateSettings as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(<SettingsPanel settings={mockSettings} onUpdate={mockOnUpdate} />);

    const haltButton = screen.getByText('Halt Trading');
    fireEvent.click(haltButton);

    const confirmButton = screen.getByText('Yes, Halt Trading');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('Updating...')).toBeInTheDocument();
    });
  });

  it('should display last updated timestamp', () => {
    render(<SettingsPanel settings={mockSettings} />);

    expect(screen.getByText(/Last Updated:/)).toBeInTheDocument();
  });
});
