export interface PrintSettings {
    duplex: boolean;
    layout: '1-up' | '2-up' | '4-up';
    pageRange?: string;
    copies?: number;
}

export interface PrintRequest {
    filename: string;
    settings: PrintSettings;
    printerName: string;
}

export interface PrinterInfo {
    name: string;
    description: string;
    location: string;
    state: string;
    stateReasons: string[];
}

export interface PrintJob {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'awaiting-even-pages';
    message?: string;
    totalPages?: number;
    currentStep?: 'odd' | 'even';
}

export interface UploadResponse {
    filename: string;
    originalName: string;
    size: number;
    pageCount: number;
}
