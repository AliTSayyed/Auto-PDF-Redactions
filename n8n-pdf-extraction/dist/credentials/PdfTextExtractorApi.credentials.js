"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfTextExtractorApi = void 0;
class PdfTextExtractorApi {
    constructor() {
        this.name = 'pdfTextExtractorApi';
        this.displayName = 'PDF Text Extractor API';
        this.documentationUrl = 'https://example.com/docs/auth';
        this.properties = [
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
}
exports.PdfTextExtractorApi = PdfTextExtractorApi;
//# sourceMappingURL=PdfTextExtractorApi.credentials.js.map