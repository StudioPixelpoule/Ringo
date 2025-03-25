import { ProcessingProgress, ProcessingOptions, ProcessingResult } from './types';

export async function processDocument(
  file: File,
  options?: ProcessingOptions
): Promise<ProcessingResult> {
  try {
    options?.onProgress?.({
      stage: 'preparation',
      progress: 10,
      message: 'Préparation du document...'
    });

    const extension = file.name.split('.').pop()?.toLowerCase();
    let content: string;

    // Process based on file type
    if (extension === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      content = await processPDF(arrayBuffer, options);
    } else if (['doc', 'docx'].includes(extension || '')) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      content = result.value;
    } else if (['json', 'csv', 'xlsx', 'xls'].includes(extension || '')) {
      if (extension === 'json') {
        content = await file.text();
        // Validate and format JSON
        const parsed = JSON.parse(content);
        content = JSON.stringify(parsed, null, 2);
      } else if (extension === 'csv') {
        content = await processCSV(file, options);
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, {
          type: 'array',
          cellDates: true,
          cellNF: false,
          cellText: false
        });

        // Process all sheets
        const result = workbook.SheetNames.reduce((acc, sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(sheet, {
            raw: false,
            dateNF: 'YYYY-MM-DD',
            defval: null
          });
          acc[sheetName] = data;
          return acc;
        }, {} as Record<string, any>);

        content = JSON.stringify(result, null, 2);
      }
    } else {
      content = await file.text();
    }

    options?.onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Traitement terminé'
    });

    return content;
  } catch (error) {
    logError(error, {
      component: 'documentProcessor',
      action: 'processDocument',
      fileType: file.type,
      fileName: file.name,
      fileSize: file.size
    });
    throw error;
  }
}