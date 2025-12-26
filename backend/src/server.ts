import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs-extra';
import { upload } from './middleware/upload';
import { PDFProcessor } from './services/pdf-processor';
import { CupsClient } from './services/cups-client';
import { PrintRequest, PrintJob, UploadResponse } from './types';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const TEMP_DIR = process.env.TEMP_DIR || path.join(__dirname, '../../temp');

// Ensure directories exist
fs.ensureDirSync(UPLOAD_DIR);
fs.ensureDirSync(TEMP_DIR);

// Initialize services
const pdfProcessor = new PDFProcessor(TEMP_DIR);
const cupsClient = new CupsClient(
    process.env.CUPS_URL,
    process.env.CUPS_PRINTER_NAME
);

// Middleware
app.use(cors());
app.use(express.json());

// Serve Static Files (Frontend)
if (process.env.NODE_ENV === 'production') {
    const FRONTEND_BUILD = path.join(__dirname, '../../frontend/dist');
    app.use(express.static(FRONTEND_BUILD));
}

// Store active print jobs (in production, use a database)
const printJobs = new Map<string, PrintJob>();

/**
 * POST /api/upload - Upload a PDF file
 */
app.post('/api/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const pageCount = await pdfProcessor.getPageCount(req.file.path);

        const response: UploadResponse = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            pageCount
        };

        res.json(response);
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to process uploaded file' });
    }
});

/**
 * GET /api/printers - Get list of available printers
 */
app.get('/api/printers', async (req: Request, res: Response) => {
    try {
        const printers = await cupsClient.getPrinters();
        res.json(printers);
    } catch (error) {
        console.error('Error fetching printers:', error);
        res.status(500).json({ error: 'Failed to fetch printers from CUPS' });
    }
});

/**
 * POST /api/print - Submit a print job
 */
app.post('/api/print', async (req: Request, res: Response) => {
    try {
        const printRequest: PrintRequest = req.body;

        if (!printRequest.filename || !printRequest.settings) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const filePath = path.join(UPLOAD_DIR, printRequest.filename);

        if (!await fs.pathExists(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        let processedFilePath = filePath;

        // Process PDF based on settings
        if (printRequest.settings.duplex) {
            // For duplex printing, we'll first print odd pages
            processedFilePath = await pdfProcessor.extractOddEvenPages(
                filePath,
                'odd',
                printRequest.settings.pageRange
            );

            printJobs.set(jobId, {
                id: jobId,
                status: 'processing',
                currentStep: 'odd',
                message: 'Printing odd pages...'
            });
        } else if (printRequest.settings.layout !== '1-up') {
            // Apply n-up layout
            processedFilePath = await pdfProcessor.createNUpLayout(
                filePath,
                printRequest.settings.layout,
                printRequest.settings.pageRange
            );

            printJobs.set(jobId, {
                id: jobId,
                status: 'processing',
                message: `Creating ${printRequest.settings.layout} layout...`
            });
        } else if (printRequest.settings.pageRange) {
            // Extract page range only
            processedFilePath = await pdfProcessor.extractPageRange(
                filePath,
                printRequest.settings.pageRange
            );

            printJobs.set(jobId, {
                id: jobId,
                status: 'processing',
                message: 'Extracting page range...'
            });
        } else {
            printJobs.set(jobId, {
                id: jobId,
                status: 'processing',
                message: 'Sending to printer...'
            });
        }

        // Submit to CUPS
        const cupsJob = await cupsClient.printFile(
            processedFilePath,
            printRequest.printerName,
            `Print Job - ${printRequest.filename}`,
            printRequest.settings.copies || 1
        );

        // Update job status
        if (printRequest.settings.duplex) {
            printJobs.set(jobId, {
                id: jobId,
                status: 'awaiting-even-pages',
                currentStep: 'even',
                message: 'Odd pages sent to printer. Please flip the paper and print even pages.',
                totalPages: await pdfProcessor.getPageCount(filePath)
            });
        } else {
            printJobs.set(jobId, {
                id: jobId,
                status: 'completed',
                message: 'Print job submitted successfully'
            });
        }

        res.json({
            jobId,
            cupsJobId: cupsJob.jobId,
            status: printJobs.get(jobId)
        });

        // Clean up processed file if it's different from original
        if (processedFilePath !== filePath) {
            setTimeout(() => fs.remove(processedFilePath).catch(console.error), 60000);
        }
    } catch (error) {
        console.error('Print error:', error);
        res.status(500).json({ error: 'Failed to submit print job' });
    }
});

/**
 * POST /api/print-even - Print even pages for duplex
 */
app.post('/api/print-even', async (req: Request, res: Response) => {
    try {
        const { jobId, filename, printerName, pageRange, copies } = req.body;

        if (!jobId || !filename) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const job = printJobs.get(jobId);
        if (!job || job.status !== 'awaiting-even-pages') {
            return res.status(400).json({ error: 'Invalid job or job not awaiting even pages' });
        }

        const filePath = path.join(UPLOAD_DIR, filename);

        if (!await fs.pathExists(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Process even pages
        const processedFilePath = await pdfProcessor.extractOddEvenPages(
            filePath,
            'even',
            pageRange
        );

        // Submit to CUPS
        const cupsJob = await cupsClient.printFile(
            processedFilePath,
            printerName,
            `Print Job - ${filename} (Even Pages)`,
            copies || 1
        );

        // Update job status
        printJobs.set(jobId, {
            id: jobId,
            status: 'completed',
            message: 'Duplex printing completed'
        });

        res.json({
            jobId,
            cupsJobId: cupsJob.jobId,
            status: printJobs.get(jobId)
        });

        // Clean up processed file
        setTimeout(() => fs.remove(processedFilePath).catch(console.error), 60000);
    } catch (error) {
        console.error('Print even pages error:', error);
        res.status(500).json({ error: 'Failed to print even pages' });
    }
});

/**
 * GET /api/status/:jobId - Get print job status
 */
app.get('/api/status/:jobId', (req: Request, res: Response) => {
    const job = printJobs.get(req.params.jobId);

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React App (SPA catch-all)
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
    });
}

// Periodic cleanup of temp files
setInterval(() => {
    const maxAge = parseInt(process.env.TEMP_FILE_CLEANUP || '3600000');
    pdfProcessor.cleanupTempFiles(maxAge).catch(console.error);
}, 600000); // Run every 10 minutes

// Start server
app.listen(PORT, async () => {
    console.log(`🖨️  Print Web Backend running on http://localhost:${PORT}`);
    console.log(`📁 Upload directory: ${UPLOAD_DIR}`);
    console.log(`📁 Temp directory: ${TEMP_DIR}`);
    console.log(`🖨️  CUPS URL: ${process.env.CUPS_URL || 'http://localhost:631'}`);

    // Initial connection check
    try {
        console.log('Testing connection to CUPS server...');
        const printers = await cupsClient.getPrinters();
        console.log(`✅ Successfully connected to CUPS. Found ${printers.length} printers.`);
    } catch (error) {
        console.error('❌ Failed to connect to CUPS server on startup.');
        console.error('   Please check your CUPS_URL in .env or docker-compose.yml');
        console.error('   Ensure CUPS is running and accessible.');
    }
});

export default app;
