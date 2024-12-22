import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class PdfTextExtractorApi implements ICredentialType {
	name = 'pdfTextExtractorApi';
	displayName = 'PDF Text Extractor API';
	documentationUrl = 'https://example.com/docs/auth';
	properties: INodeProperties[] = [
		{
				displayName: 'API Key',
				name: 'apiKey',
				type: 'string',
				typeOptions: {
					password: true,
			},
				default: '',
				required: false,
		},
];
}
