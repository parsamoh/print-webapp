import axios from 'axios';
import { PrinterInfo, PrintSettings, PrintJob, UploadResponse } from '../types';

const api = axios.create({
    baseURL: '/api'
});

export const getPrinters = async (): Promise<PrinterInfo[]> => {
    const response = await api.get<PrinterInfo[]>('/printers');
    return response.data;
};

export const uploadFile = async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<UploadResponse>('/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

export const submitPrintJob = async (
    filename: string,
    printerName: string,
    settings: PrintSettings
): Promise<{ jobId: string, status: PrintJob }> => {
    const response = await api.post<{ jobId: string, status: PrintJob }>('/print', {
        filename,
        printerName,
        settings
    });
    return response.data;
};

export const printEvenPages = async (
    jobId: string,
    filename: string,
    printerName: string,
    copies: number
): Promise<{ jobId: string, status: PrintJob }> => {
    const response = await api.post<{ jobId: string, status: PrintJob }>('/print-even', {
        jobId,
        filename,
        printerName,
        copies
    });
    return response.data;
};

export const getJobStatus = async (jobId: string): Promise<PrintJob> => {
    const response = await api.get<PrintJob>(`/status/${jobId}`);
    return response.data;
};
