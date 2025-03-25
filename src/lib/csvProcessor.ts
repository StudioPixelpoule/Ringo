import Papa from 'papaparse';
import { logError } from './errorLogger';

interface ProcessingProgress {
  stage: 'preparation' | 'processing' | 'extraction' | 'complete';
  progress: number;
  message: string;
}

interface ProcessingOptions {
  onProgress?: (progress: ProcessingProgress) => void;
  signal?: AbortSignal;
}

interface CSVProcessingResult {
  data: Record<string, any>[];
  stats: {
    rowCount: number;
    columnCount: number;
    headers: string[];
    types: Record<string, string>;
    nullCount: Record<string, number>;
    uniqueCount: Record<string, number>;
  };
}

// Detect CSV delimiter
function detectDelimiter(sample: string): string {
  const delimiters = [',', ';', '\t', '|'];
  const counts = delimiters.map(d => ({
    delimiter: d,
    count: (sample.match(new RegExp(d, 'g')) || []).length
  }));
  
  return counts.reduce((a, b) => a.count > b.count ? a : b).delimiter;
}

// Detect encoding from BOM
function detectEncoding(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);
  
  // UTF-8 BOM
  if (uint8Array[0] === 0xEF && uint8Array[1] === 0xBB && uint8Array[2] === 0xBF) {
    return 'UTF-8';
  }
  
  // UTF-16 LE BOM
  if (uint8Array[0] === 0xFF && uint8Array[1] === 0xFE) {
    return 'UTF-16LE';
  }
  
  // UTF-16 BE BOM
  if (uint8Array[0] === 0xFE && uint8Array[1] === 0xFF) {
    return 'UTF-16BE';
  }
  
  // Default to UTF-8
  return 'UTF-8';
}

// Detect column types
function inferColumnTypes(data: any[]): Record<string, string> {
  const types: Record<string, Set<string>> = {};
  
  data.forEach(row => {
    Object.entries(row).forEach(([key, value]) => {
      if (!types[key]) {
        types[key] = new Set();
      }
      
      if (value === null || value === undefined || value === '') {
        types[key].add('null');
      } else if (!isNaN(Number(value))) {
        types[key].add('number');
      } else if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        types[key].add('date');
      } else if (typeof value === 'boolean' || /^(true|false)$/i.test(value)) {
        types[key].add('boolean');
      } else {
        types[key].add('string');
      }
    });
  });
  
  return Object.fromEntries(
    Object.entries(types).map(([key, typeSet]) => {
      const typeArray = Array.from(typeSet);
      typeArray.sort((a, b) => {
        if (a === 'null') return 1;
        if (b === 'null') return -1;
        return 0;
      });
      return [key, typeArray[0]];
    })
  );
}

// Calculate column statistics
function calculateStats(data: any[]): CSVProcessingResult['stats'] {
  const headers = Object.keys(data[0] || {});
  const types = inferColumnTypes(data);
  
  const nullCount: Record<string, number> = {};
  const uniqueValues: Record<string, Set<any>> = {};
  
  headers.forEach(header => {
    nullCount[header] = 0;
    uniqueValues[header] = new Set();
  });
  
  data.forEach(row => {
    headers.forEach(header => {
      const value = row[header];
      if (value === null || value === undefined || value === '') {
        nullCount[header]++;
      } else {
        uniqueValues[header].add(value);
      }
    });
  });
  
  return {
    rowCount: data.length,
    columnCount: headers.length,
    headers,
    types,
    nullCount,
    uniqueCount: Object.fromEntries(
      Object.entries(uniqueValues).map(([key, set]) => [key, set.size])
    )
  };
}

// Convert data types based on inferred types
function convertDataTypes(data: any[], types: Record<string, string>): any[] {
  return data.map(row => {
    const convertedRow: Record<string, any> = {};
    
    Object.entries(row).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        convertedRow[key] = null;
        return;
      }
      
      switch (types[key]) {
        case 'number':
          convertedRow[key] = Number(value);
          break;
        case 'date':
          convertedRow[key] = new Date(value).toISOString();
          break;
        case 'boolean':
          convertedRow[key] = /^true$/i.test(String(value));
          break;
        default:
          convertedRow[key] = String(value);
      }
    });
    
    return convertedRow;
  });
}

export async function processCSV(
  file: File,
  options: ProcessingOptions = {}
): Promise<string> {
  const { onProgress, signal } = options;
  
  try {
    onProgress?.({
      stage: 'preparation',
      progress: 10,
      message: 'Analyse du fichier CSV...'
    });
    
    // Read file as array buffer to detect encoding
    const buffer = await file.arrayBuffer();
    const encoding = detectEncoding(buffer);
    
    // Read first chunk to detect delimiter
    const sample = new TextDecoder(encoding).decode(buffer.slice(0, 1024));
    const delimiter = detectDelimiter(sample);
    
    onProgress?.({
      stage: 'processing',
      progress: 30,
      message: 'Traitement des données...'
    });
    
    // Parse CSV with proper configuration
    const parseResult = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter,
        encoding,
        transformHeader: (header) => header.trim(),
        transform: (value) => value.trim(),
        complete: (results) => resolve(results),
        error: (error) => reject(error),
        worker: true // Use web worker for large files
      });
    });
    
    if (parseResult.errors.length > 0) {
      const errors = parseResult.errors
        .map(e => `Ligne ${e.row}: ${e.message}`)
        .join('\n');
      throw new Error(`Erreurs de parsing CSV:\n${errors}`);
    }
    
    onProgress?.({
      stage: 'extraction',
      progress: 60,
      message: 'Analyse des types de données...'
    });
    
    // Calculate statistics and infer types
    const stats = calculateStats(parseResult.data);
    
    // Convert data types
    const typedData = convertDataTypes(parseResult.data, stats.types);
    
    onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Traitement terminé'
    });
    
    // Return formatted result
    const result: CSVProcessingResult = {
      data: typedData,
      stats
    };
    
    return JSON.stringify(result, null, 2);
  } catch (error) {
    logError(error, {
      component: 'csvProcessor',
      action: 'processCSV',
      fileName: file.name,
      fileSize: file.size
    });
    throw error;
  }
}