import { IExecuteFunctions } from 'n8n-workflow';
import {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class PdfTextExtractor implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'PDF Text Extractor',
		name: 'pdfTextExtractor',
		icon: 'file:GetBrainLogoCircle.svg',
		group: ['transform'],
		version: 1,
		description:
			'Extracts specific text from a base64-encoded PDF and returns the text with its coordinates (x, y, width, height)',
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		try {
			 // Import the legacy build
			 const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

			 // Disable worker for Node environment
			 pdfjsLib.GlobalWorkerOptions.workerSrc = false;

			for (let i = 0; i < items.length; i++) {
				const base64Pdf = this.getNodeParameter('base64Pdf', i) as string;
				const searchTextArrayStr = this.getNodeParameter('searchTextArray', i) as string;
				let searchTextArray: string[];

				try {
					searchTextArray = JSON.parse(searchTextArrayStr);
				} catch (error) {
					throw new NodeOperationError(
						this,
						`Invalid JSON array for search text: ${error.message}`,
					);
				}

				// Validate input types
				if (
					!Array.isArray(searchTextArray) ||
					searchTextArray.some((text) => typeof text !== 'string')
				) {
					throw new NodeOperationError(
						this,
						'The search text array must be a valid JSON array of strings.',
					);
				}

				// Convert base64 to Buffer with type assertion
				const pdfBuffer = Buffer.from(base64Pdf, 'base64');
				const pdfData = new Uint8Array(pdfBuffer);

				// Load the PDF document - Use pdf instead of pdfjsLib
				const loadingTask = pdfjsLib.getDocument({ data: pdfData });
				const pdfDocument = await loadingTask.promise;
				const matchedTexts: {
					text: string;
					x: number;
					y: number;
					width: number;
					height: number;
					pageWidth: number;
					pageHeight: number;
				}[] = [];

				// Loop through each page of the PDF
				for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
					const page = await pdfDocument.getPage(pageNum);
					const textContent = await page.getTextContent();
					const viewport = page.getViewport({ scale: 1.0 });
					const pageWidth = viewport.width;
					const pageHeight = viewport.height;


					textContent.items.forEach((item: any) => {
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
		} catch (error) {
			console.error('PDF processing error:', error);
			throw new NodeOperationError(this, `Error processing PDF: ${error.message}`);
		}
		return [results];
	}
}
