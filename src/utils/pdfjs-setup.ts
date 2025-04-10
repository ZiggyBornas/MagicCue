import { getDocument, GlobalWorkerOptions, version } from 'pdfjs-dist';
import { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import 'pdfjs-dist/build/pdf.worker.min.js';

// Set up PDF.js worker
GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.js`;

export type PDFDocumentType = PDFDocumentProxy;
export const getDocumentFromFile = getDocument;
export default { getDocument, GlobalWorkerOptions }; 