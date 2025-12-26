import { useState, useEffect } from 'react';
import { UploadZone } from './components/UploadZone';
import { PrintSettings } from './components/PrintSettings';
import { PrintPreview } from './components/PrintPreview';
import { getPrinters, uploadFile, submitPrintJob, printEvenPages } from './services/api';
import { PrinterInfo, PrintSettings as PrintSettingsType, UploadResponse, PrintJob } from './types';
import './App.css';

function App() {
    // State
    const [printers, setPrinters] = useState<PrinterInfo[]>([]);
    const [selectedPrinter, setSelectedPrinter] = useState<string>('');
    const [file, setFile] = useState<UploadResponse | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);

    const [settings, setSettings] = useState<PrintSettingsType>({
        duplex: false,
        layout: '1-up',
        copies: 1,
        pageRange: ''
    });

    const [activeJob, setActiveJob] = useState<PrintJob | null>(null);
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Initial load
    useEffect(() => {
        fetchPrinters();
    }, []);

    const fetchPrinters = async () => {
        setIsLoadingPrinters(true);
        try {
            const list = await getPrinters();
            setPrinters(list);
            // Auto-select first printer if none selected
            if (!selectedPrinter && list.length > 0) {
                setSelectedPrinter(list[0].name);
            }
        } catch (err) {
            console.error(err);
            setNotification({ type: 'error', message: 'Failed to load printers' });
        } finally {
            setIsLoadingPrinters(false);
        }
    };

    const handleFileSelect = async (selectedFile: File) => {
        setIsUploading(true);
        setNotification(null);
        try {
            const response = await uploadFile(selectedFile);
            setFile(response);
        } catch (err) {
            setNotification({ type: 'error', message: 'Failed to upload file' });
        } finally {
            setIsUploading(false);
        }
    };

    const handlePrint = async () => {
        if (!file || !selectedPrinter) return;

        try {
            setNotification(null);
            const { jobId, status } = await submitPrintJob(file.filename, selectedPrinter, settings);
            setActiveJob({ ...status, id: jobId });

            if (!settings.duplex) {
                setNotification({ type: 'success', message: 'Print job submitted successfully!' });
                setTimeout(() => {
                    setActiveJob(null);
                    setFile(null); // Reset for next job
                }, 3000);
            }
        } catch (err) {
            setNotification({ type: 'error', message: 'Failed to submit print job' });
        }
    };

    const handlePrintEven = async () => {
        if (!activeJob || !file || !selectedPrinter) return;

        try {
            setNotification(null);
            const { status } = await printEvenPages(
                activeJob.id,
                file.filename,
                selectedPrinter,
                settings.copies
            );

            setActiveJob({ ...status, id: activeJob.id });
            setNotification({ type: 'success', message: 'Duplex job completed!' });

            setTimeout(() => {
                setActiveJob(null);
                setFile(null);
            }, 3000);
        } catch (err) {
            setNotification({ type: 'error', message: 'Failed to print even pages' });
        }
    };

    // Render helpers
    const renderJobStatus = () => {
        if (!activeJob) return null;

        if (activeJob.status === 'awaiting-even-pages') {
            return (
                <div className="panel instruction-step">
                    <div className="status-card warning">
                        <span style={{ fontSize: '2rem' }}>🔄</span>
                        <div>
                            <h3>Time to Flip!</h3>
                            <p>Odd pages have been sent to the printer.</p>
                        </div>
                    </div>

                    <div style={{ margin: '2rem 0' }}>
                        <h2>Wait for printing to finish...</h2>
                        <p>1. Take the printed stack from the output tray.</p>
                        <p>2. Flip the stack over (keep the same orientation).</p>
                        <p>3. Place it back in the input tray.</p>
                        <p>4. Click the button below.</p>
                    </div>

                    <button className="btn-primary" onClick={handlePrintEven}>
                        Resume & Print Even Pages
                    </button>
                </div>
            );
        }

        return (
            <div className={`status-card ${activeJob.status === 'failed' ? 'warning' : 'info'}`}>
                <strong>Status:</strong> {activeJob.message || activeJob.status}
            </div>
        );
    };

    return (
        <div className="container">
            <header>
                <h1>Antigravity Print</h1>
                <p>Smart Printing for Legacy Hardware</p>
            </header>

            {/* Main Content */}
            {!activeJob || activeJob.status !== 'awaiting-even-pages' ? (
                <>
                    <div className="panel">
                        {!file ? (
                            <UploadZone onFileSelect={handleFileSelect} isUploading={isUploading} />
                        ) : (
                            <PrintPreview fileInfo={file} onClear={() => setFile(null)} />
                        )}
                    </div>

                    <div className="panel">
                        <PrintSettings
                            settings={settings}
                            printers={printers}
                            selectedPrinter={selectedPrinter}
                            onSettingsChange={setSettings}
                            onPrinterChange={setSelectedPrinter}
                            onRefreshPrinters={fetchPrinters}
                            isLoadingPrinters={isLoadingPrinters}
                            disabled={!file || isUploading}
                        />
                    </div>

                    {notification && (
                        <div className={`status-card ${notification.type === 'error' ? 'warning' : 'info'}`}>
                            {notification.message}
                        </div>
                    )}

                    <div className="actions">
                        <button
                            className="btn-primary"
                            onClick={handlePrint}
                            disabled={!file || !selectedPrinter || isUploading}
                        >
                            {settings.duplex ? 'Start Duplex Print' : 'Print Document'}
                        </button>
                    </div>
                </>
            ) : (
                /* Status / Wizard View */
                renderJobStatus()
            )}
        </div>
    );
}

export default App;
