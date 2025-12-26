import { PDFDocument } from 'pdf-lib';
import fs from 'fs-extra';
import path from 'path';

export class PDFProcessor {
    private tempDir: string;

    constructor(tempDir: string = process.env.TEMP_DIR || './temp') {
        this.tempDir = tempDir;
        fs.ensureDirSync(this.tempDir);
    }

    /**
     * Get the total number of pages in a PDF
     */
    async getPageCount(pdfPath: string): Promise<number> {
        const pdfBytes = await fs.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        return pdfDoc.getPageCount();
    }

    /**
     * Parse page range string (e.g., "1-5,7,10-12") and return array of page numbers
     */
    private parsePageRange(range: string, totalPages: number): number[] {
        const pages: number[] = [];
        const parts = range.split(',').map(p => p.trim());

        for (const part of parts) {
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(n => parseInt(n.trim()));
                for (let i = start; i <= Math.min(end, totalPages); i++) {
                    if (i >= 1) pages.push(i);
                }
            } else {
                const pageNum = parseInt(part);
                if (pageNum >= 1 && pageNum <= totalPages) {
                    pages.push(pageNum);
                }
            }
        }

        return [...new Set(pages)].sort((a, b) => a - b);
    }

    /**
     * Extract odd or even pages from a PDF
     */
    async extractOddEvenPages(
        inputPath: string,
        pageType: 'odd' | 'even',
        pageRange?: string
    ): Promise<string> {
        const pdfBytes = await fs.readFile(inputPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const totalPages = pdfDoc.getPageCount();

        // Determine which pages to include
        let pagesToProcess: number[];
        if (pageRange) {
            pagesToProcess = this.parsePageRange(pageRange, totalPages);
        } else {
            pagesToProcess = Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        // Filter for odd or even pages
        const filteredPages = pagesToProcess.filter(pageNum => {
            if (pageType === 'odd') {
                return pageNum % 2 === 1;
            } else {
                return pageNum % 2 === 0;
            }
        });

        // Create new PDF with selected pages
        const newPdfDoc = await PDFDocument.create();
        for (const pageNum of filteredPages) {
            const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNum - 1]);
            newPdfDoc.addPage(copiedPage);
        }

        const newPdfBytes = await newPdfDoc.save();
        const outputPath = path.join(
            this.tempDir,
            `${path.basename(inputPath, '.pdf')}-${pageType}-${Date.now()}.pdf`
        );
        await fs.writeFile(outputPath, newPdfBytes);

        return outputPath;
    }

    /**
     * Create n-up layout (multiple pages per sheet)
     * @param inputPath Path to input PDF
     * @param layout Number of pages per sheet (2 or 4)
     */
    async createNUpLayout(
        inputPath: string,
        layout: '2-up' | '4-up',
        pageRange?: string
    ): Promise<string> {
        const pdfBytes = await fs.readFile(inputPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const totalPages = pdfDoc.getPageCount();

        // Determine which pages to include
        let pagesToProcess: number[];
        if (pageRange) {
            pagesToProcess = this.parsePageRange(pageRange, totalPages);
        } else {
            pagesToProcess = Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        const newPdfDoc = await PDFDocument.create();
        const pagesPerSheet = layout === '2-up' ? 2 : 4;

        // Standard A4 size in points (595 x 842)
        const sheetWidth = 842; // Landscape orientation for n-up
        const sheetHeight = 595;

        // Calculate layout dimensions
        let cols: number, rows: number;
        if (layout === '2-up') {
            cols = 2;
            rows = 1;
        } else { // 4-up
            cols = 2;
            rows = 2;
        }

        const cellWidth = sheetWidth / cols;
        const cellHeight = sheetHeight / rows;

        // Process pages in groups
        for (let i = 0; i < pagesToProcess.length; i += pagesPerSheet) {
            const newPage = newPdfDoc.addPage([sheetWidth, sheetHeight]);

            for (let j = 0; j < pagesPerSheet && i + j < pagesToProcess.length; j++) {
                const pageIndex = pagesToProcess[i + j] - 1;
                const [embeddedPage] = await newPdfDoc.embedPdf(pdfDoc, [pageIndex]);

                // Calculate position
                const col = j % cols;
                const row = Math.floor(j / cols);

                // Scale to fit cell while maintaining aspect ratio
                const scale = Math.min(
                    cellWidth / embeddedPage.width,
                    cellHeight / embeddedPage.height
                ) * 0.95; // 95% to add some margin

                const x = col * cellWidth + (cellWidth - embeddedPage.width * scale) / 2;
                const y = sheetHeight - (row + 1) * cellHeight + (cellHeight - embeddedPage.height * scale) / 2;

                newPage.drawPage(embeddedPage, {
                    x,
                    y,
                    width: embeddedPage.width * scale,
                    height: embeddedPage.height * scale,
                });
            }
        }

        const newPdfBytes = await newPdfDoc.save();
        const outputPath = path.join(
            this.tempDir,
            `${path.basename(inputPath, '.pdf')}-${layout}-${Date.now()}.pdf`
        );
        await fs.writeFile(outputPath, newPdfBytes);

        return outputPath;
    }

    /**
     * Extract specific page range from PDF
     */
    async extractPageRange(inputPath: string, pageRange: string): Promise<string> {
        const pdfBytes = await fs.readFile(inputPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const totalPages = pdfDoc.getPageCount();

        const pagesToInclude = this.parsePageRange(pageRange, totalPages);

        const newPdfDoc = await PDFDocument.create();
        for (const pageNum of pagesToInclude) {
            const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNum - 1]);
            newPdfDoc.addPage(copiedPage);
        }

        const newPdfBytes = await newPdfDoc.save();
        const outputPath = path.join(
            this.tempDir,
            `${path.basename(inputPath, '.pdf')}-range-${Date.now()}.pdf`
        );
        await fs.writeFile(outputPath, newPdfBytes);

        return outputPath;
    }

    /**
     * Clean up temporary files older than specified age
     */
    async cleanupTempFiles(maxAge: number = 3600000): Promise<void> {
        const files = await fs.readdir(this.tempDir);
        const now = Date.now();

        for (const file of files) {
            const filePath = path.join(this.tempDir, file);
            const stats = await fs.stat(filePath);

            if (now - stats.mtimeMs > maxAge) {
                await fs.remove(filePath);
            }
        }
    }
}
