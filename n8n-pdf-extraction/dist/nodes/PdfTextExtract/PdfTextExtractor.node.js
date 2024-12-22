"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfTextExtractor = void 0;
const n8n_workflow_1 = require("n8n-workflow");
class PdfTextExtractor {
    constructor() {
        this.description = {
            displayName: 'PDF Text Extractor',
            name: 'pdfTextExtractor',
            icon: 'file:GetBrainLogoCircle.svg',
            group: ['transform'],
            version: 1,
            description: 'Extracts specific text from a base64-encoded PDF and returns the text with its coordinates (x, y, width, height)',
            defaults: {
                name: 'PDF Text Extractor',
            },
            inputs: ['main'],
            outputs: ['main'],
            properties: [
                {
                    displayName: 'Base64 Encoded PDF',
                    name: 'base64Pdf',
                    type: 'string',
                    default: '',
                    placeholder: 'Paste your Base64 encoded PDF here',
                    description: 'The PDF file encoded in base64 format',
                    required: true,
                },
                {
                    displayName: 'Search Text Array (JSON Array of Strings)',
                    name: 'searchTextArray',
                    type: 'string',
                    default: '',
                    placeholder: '["example", "text", "to", "search"]',
                    description: 'A JSON array of strings to search for in the PDF',
                    required: true,
                },
            ],
        };
    }
    async execute() {
        const items = this.getInputData();
        const results = [];
        try {
            const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
            pdfjsLib.GlobalWorkerOptions.workerSrc = false;
            for (let i = 0; i < items.length; i++) {
                const base64Pdf = this.getNodeParameter('base64Pdf', i);
                const searchTextArrayStr = this.getNodeParameter('searchTextArray', i);
                let searchTextArray;
                try {
                    searchTextArray = JSON.parse(searchTextArrayStr);
                }
                catch (error) {
                    throw new n8n_workflow_1.NodeOperationError(this, `Invalid JSON array for search text: ${error.message}`);
                }
                if (!Array.isArray(searchTextArray) ||
                    searchTextArray.some((text) => typeof text !== 'string')) {
                    throw new n8n_workflow_1.NodeOperationError(this, 'The search text array must be a valid JSON array of strings.');
                }
                const pdfBuffer = Buffer.from(base64Pdf, 'base64');
                const pdfData = new Uint8Array(pdfBuffer);
                const loadingTask = pdfjsLib.getDocument({ data: pdfData });
                const pdfDocument = await loadingTask.promise;
                const matchedTexts = [];
                for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
                    const page = await pdfDocument.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    const viewport = page.getViewport({ scale: 1.0 });
                    const pageWidth = viewport.width;
                    const pageHeight = viewport.height;
                    textContent.items.forEach((item) => {
                        const text = item.str;
                        const transform = item.transform;
                        const [, , , , x, y] = transform;
                        const width = item.width;
                        const height = item.height;
                        if (searchTextArray.includes(text)) {
                            matchedTexts.push({
                                text,
                                x,
                                y,
                                width,
                                height,
                                pageWidth,
                                pageHeight,
                            });
                        }
                    });
                }
                results.push({
                    json: {
                        matchedTexts,
                    },
                });
            }
        }
        catch (error) {
            console.error('PDF processing error:', error);
            throw new n8n_workflow_1.NodeOperationError(this, `Error processing PDF: ${error.message}`);
        }
        return [results];
    }
}
exports.PdfTextExtractor = PdfTextExtractor;
//# sourceMappingURL=PdfTextExtractor.node.js.map