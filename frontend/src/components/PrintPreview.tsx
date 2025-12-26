import React from 'react';
import { UploadResponse } from '../types';

interface PrintPreviewProps {
    fileInfo: UploadResponse | null;
    onClear: () => void;
}

export const PrintPreview: React.FC<PrintPreviewProps> = ({ fileInfo, onClear }) => {
    if (!fileInfo) return null;

    return (
        <div className="print-preview">
            <div className="preview-header">
                <h3>Document Preview</h3>
                <button className="clear-btn" onClick={onClear}>
                    Remove
                </button>
            </div>

            <div className="file-info-card">
                <div className="file-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                </div>
                <div className="file-details">
                    <div className="filename" title={fileInfo.originalName}>
                        {fileInfo.originalName}
                    </div>
                    <div className="meta">
                        <span className="badge">{fileInfo.pageCount} Pages</span>
                        <span className="badge">{(fileInfo.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
