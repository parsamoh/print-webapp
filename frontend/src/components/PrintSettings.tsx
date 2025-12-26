import React from 'react';
import { PrinterInfo, PrintSettings as PrintSettingsType } from '../types';

interface PrintSettingsProps {
    settings: PrintSettingsType;
    printers: PrinterInfo[];
    selectedPrinter: string;
    onSettingsChange: (settings: PrintSettingsType) => void;
    onPrinterChange: (printerName: string) => void;
    onRefreshPrinters: () => void;
    isLoadingPrinters: boolean;
    disabled: boolean;
}

export const PrintSettings: React.FC<PrintSettingsProps> = ({
    settings,
    printers,
    selectedPrinter,
    onSettingsChange,
    onPrinterChange,
    onRefreshPrinters,
    isLoadingPrinters,
    disabled
}) => {
    const handleChange = (field: keyof PrintSettingsType, value: any) => {
        onSettingsChange({
            ...settings,
            [field]: value
        });
    };

    return (
        <div className="print-settings-panel">
            <h3>Print Settings</h3>

            <div className="setting-group">
                <label>Printer</label>
                <div className="printer-select-row">
                    <select
                        value={selectedPrinter}
                        onChange={(e) => onPrinterChange(e.target.value)}
                        disabled={disabled}
                    >
                        <option value="" disabled>Select a printer</option>
                        {printers.map(p => (
                            <option key={p.name} value={p.name}>
                                {p.name} ({p.state})
                            </option>
                        ))}
                    </select>
                    <button
                        className="icon-btn"
                        onClick={onRefreshPrinters}
                        disabled={isLoadingPrinters || disabled}
                        title="Refresh Printers"
                    >
                        ↻
                    </button>
                </div>
            </div>

            <div className="setting-group">
                <div className="toggle-row">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={settings.duplex}
                            onChange={(e) => handleChange('duplex', e.target.checked)}
                            disabled={disabled}
                        />
                        <span className="label-text">Duplex Mode (Manual Flip)</span>
                    </label>
                </div>
                <p className="help-text">
                    Prints odd pages first, then pauses for you to flip the pages.
                </p>
            </div>

            <div className="setting-group">
                <label>Layout</label>
                <div className="layout-options">
                    {(['1-up', '2-up', '4-up'] as const).map(layout => (
                        <button
                            key={layout}
                            className={`layout-btn ${settings.layout === layout ? 'active' : ''}`}
                            onClick={() => handleChange('layout', layout)}
                            disabled={disabled || settings.duplex}
                            title={settings.duplex ? "Layout options not available in duplex mode" : ""}
                        >
                            {layout}
                        </button>
                    ))}
                </div>
            </div>

            <div className="setting-row">
                <div className="setting-group half">
                    <label>Copies</label>
                    <input
                        type="number"
                        min="1"
                        max="100"
                        value={settings.copies}
                        onChange={(e) => handleChange('copies', parseInt(e.target.value) || 1)}
                        disabled={disabled}
                    />
                </div>

                <div className="setting-group half">
                    <label>Page Range</label>
                    <input
                        type="text"
                        placeholder="e.g. 1-5, 8, 11-13"
                        value={settings.pageRange || ''}
                        onChange={(e) => handleChange('pageRange', e.target.value)}
                        disabled={disabled}
                    />
                </div>
            </div>
        </div>
    );
};
