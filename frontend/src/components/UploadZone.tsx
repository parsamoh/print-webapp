import React, { useCallback, useState } from 'react';

interface UploadZoneProps {
    onFileSelect: (file: File) => void;
    isUploading: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onFileSelect, isUploading }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.type === 'application/pdf') {
                onFileSelect(file);
            } else {
                alert('Please upload a PDF file');
            }
        }
    }, [onFileSelect]);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onFileSelect(e.target.files[0]);
        }
    }, [onFileSelect]);

    return (
        <div
            className={`upload-zone ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
        >
            <input
                type="file"
                id="file-input"
                accept=".pdf"
                onChange={handleFileInput}
                style={{ display: 'none' }}
                disabled={isUploading}
            />

            <div className="upload-content">
                {isUploading ? (
                    <div className="loading-spinner"></div>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <h3>Drop your PDF here</h3>
                        <p>or click to browse</p>
                    </>
                )}
            </div>
        </div>
    );
};
