import ipp from 'ipp';
import { PrinterInfo } from '../types';
import fs from 'fs-extra';

export class CupsClient {
    private cupsUrl: string;
    private defaultPrinter: string;

    constructor(cupsUrl: string = 'http://localhost:631', defaultPrinter?: string) {
        this.cupsUrl = cupsUrl;
        this.defaultPrinter = defaultPrinter || '';
    }

    /**
     * Get list of available printers
     */
    async getPrinters(): Promise<PrinterInfo[]> {
        console.log(`Checking CUPS connection at ${this.cupsUrl}...`);
        return new Promise((resolve, reject) => {
            const printer = ipp.Printer(`${this.cupsUrl}/printers`);

            // Simplify request to get all attributes
            const msg = {
                'operation-attributes-tag': {
                    // removing requested-attributes to fetch everything
                }
            };

            printer.execute('CUPS-Get-Printers', msg, (err: Error | null, res: any) => {
                if (err) {
                    console.error('CUPS Connection Failed:', err);
                    reject(err);
                    return;
                }

                console.log('CUPS Raw Response:', JSON.stringify(res, null, 2)); // Log full response
                console.log('CUPS Connection Successful. Found printers.');
                const printers: PrinterInfo[] = [];

                if (res['printer-attributes-tag']) {
                    const printerGroups = Array.isArray(res['printer-attributes-tag'])
                        ? res['printer-attributes-tag']
                        : [res['printer-attributes-tag']];

                    for (const printerAttrs of printerGroups) {
                        const printerName = printerAttrs['printer-name'] || 'Unknown';
                        console.log(`Found printer: ${printerName}`);
                        printers.push({
                            name: printerName,
                            description: printerAttrs['printer-info'] || '',
                            location: printerAttrs['printer-location'] || '',
                            state: this.getPrinterStateString(printerAttrs['printer-state']),
                            stateReasons: Array.isArray(printerAttrs['printer-state-reasons'])
                                ? printerAttrs['printer-state-reasons']
                                : [printerAttrs['printer-state-reasons'] || 'none']
                        });
                    }
                } else {
                    console.log('No printers found in CUPS response.');
                }

                resolve(printers);
            });
        });
    }

    /**
     * Convert printer state number to string
     */
    private getPrinterStateString(state: number): string {
        switch (state) {
            case 3: return 'idle';
            case 4: return 'processing';
            case 5: return 'stopped';
            default: return 'unknown';
        }
    }

    /**
     * Submit a print job to CUPS
     */
    async printFile(
        filePath: string,
        printerName?: string,
        jobName: string = 'Print Job',
        copies: number = 1
    ): Promise<{ jobId: number; jobUri: string }> {
        const printer = printerName || this.defaultPrinter;
        if (!printer) {
            throw new Error('No printer specified');
        }

        return new Promise(async (resolve, reject) => {
            const printerObj = ipp.Printer(`${this.cupsUrl}/printers/${printer}`);

            const fileBuffer = await fs.readFile(filePath);

            const msg = {
                'operation-attributes-tag': {
                    'requesting-user-name': 'print-web-app',
                    'job-name': jobName,
                    'document-format': 'application/pdf'
                },
                'job-attributes-tag': {
                    'copies': copies
                },
                data: fileBuffer
            };

            printerObj.execute('Print-Job', msg, (err: Error | null, res: any) => {
                if (err) {
                    reject(err);
                    return;
                }

                const jobId = res['job-attributes-tag']?.['job-id'];
                const jobUri = res['job-attributes-tag']?.['job-uri'];

                if (!jobId) {
                    reject(new Error('Failed to get job ID from CUPS response'));
                    return;
                }

                resolve({ jobId, jobUri });
            });
        });
    }

    /**
     * Get status of a print job
     */
    async getJobStatus(jobId: number): Promise<{
        state: string;
        stateReasons: string[];
    }> {
        return new Promise((resolve, reject) => {
            const printer = ipp.Printer(this.cupsUrl);

            const msg = {
                'operation-attributes-tag': {
                    'job-id': jobId,
                    'requested-attributes': [
                        'job-state',
                        'job-state-reasons'
                    ]
                }
            };

            printer.execute('Get-Job-Attributes', msg, (err: Error | null, res: any) => {
                if (err) {
                    reject(err);
                    return;
                }

                const jobState = res['job-attributes-tag']?.['job-state'];
                const stateReasons = res['job-attributes-tag']?.['job-state-reasons'] || [];

                resolve({
                    state: this.getJobStateString(jobState),
                    stateReasons: Array.isArray(stateReasons) ? stateReasons : [stateReasons]
                });
            });
        });
    }

    /**
     * Convert job state number to string
     */
    private getJobStateString(state: number): string {
        switch (state) {
            case 3: return 'pending';
            case 4: return 'pending-held';
            case 5: return 'processing';
            case 6: return 'processing-stopped';
            case 7: return 'canceled';
            case 8: return 'aborted';
            case 9: return 'completed';
            default: return 'unknown';
        }
    }
}
