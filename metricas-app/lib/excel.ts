import { format } from "date-fns";

export interface BuildSheetOptions {
  title: string;
  metadata?: string[];
  headers: string[];
  rows: (string | number | null | undefined)[][];
  totalsRow?: (string | number | null | undefined)[];
  currencyColIndices?: number[];
  weightColIndices?: number[];
  numberColIndices?: number[];
}

/**
 * Crea una hoja de cálculo XLSX con el diseño estándar unificado de Los Bambinos:
 * - Banner de título y metadatos con celdas combinadas (!merges)
 * - Auto-ajuste dinámico de ancho de columnas (!cols) para que ningún dato se corte
 * - Formato numérico nativo de Excel (Moneda, Kilos, Enteros)
 * - Fila de totales alineada
 */
export async function createUnifiedSheet(options: BuildSheetOptions) {
  const XLSX = await import("xlsx");
  const {
    title,
    metadata = [],
    headers,
    rows,
    totalsRow,
    currencyColIndices = [],
    weightColIndices = [],
    numberColIndices = [],
  } = options;

  const aoa: any[][] = [];

  // Fila 1: Título principal
  aoa.push([title]);

  // Filas de metadatos (Sucursal, Fecha de emisión, Estados, etc.)
  metadata.forEach((meta) => {
    aoa.push([meta]);
  });

  // Espaciador antes de la tabla
  aoa.push([]);

  // Fila de encabezados de tabla
  const headerRowIndex = aoa.length;
  aoa.push(headers);

  // Filas de datos
  const dataStartRowIndex = aoa.length;
  rows.forEach((row) => {
    aoa.push(row);
  });

  // Fila opcional de totales
  if (totalsRow) {
    aoa.push([]);
    aoa.push(totalsRow);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  // 1. Combinar filas de cabecera a lo ancho de todas las columnas de la tabla
  const numCols = Math.max(headers.length, 1);
  const merges: any[] = [];
  for (let r = 0; r < headerRowIndex - 1; r++) {
    merges.push({ s: { r, c: 0 }, e: { r, c: numCols - 1 } });
  }
  worksheet["!merges"] = merges;

  // 2. Auto-ajuste dinámico de anchos de columnas garantizando legibilidad total
  const colWidths = headers.map((headerText, colIdx) => {
    let maxLen = headerText.length;

    // Calcular longitud en filas de datos y totales
    for (let r = headerRowIndex; r < aoa.length; r++) {
      const val = aoa[r]?.[colIdx];
      if (val !== undefined && val !== null) {
        let strVal = String(val);
        if (typeof val === "number") {
          if (currencyColIndices.includes(colIdx)) {
            strVal = `$ ${val.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
          } else if (weightColIndices.includes(colIdx)) {
            strVal = `${val.toFixed(2)} Kg`;
          } else {
            strVal = val.toLocaleString("es-AR");
          }
        }
        if (strVal.length > maxLen) {
          maxLen = strVal.length;
        }
      }
    }

    // Margen amplio de seguridad (+5) y ancho mínimo de 14
    return { wch: Math.min(Math.max(maxLen + 5, 14), 85) };
  });
  worksheet["!cols"] = colWidths;

  // 3. Asignar formatos numéricos nativos en las celdas numéricas
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:Z50");
  for (let R = dataStartRowIndex; R <= range.e.r; ++R) {
    // Moneda
    for (const C of currencyColIndices) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[cellRef];
      if (cell && typeof cell.v === "number") {
        cell.z = '"$"#,##0.00';
      }
    }
    // Pesos (Kg)
    for (const C of weightColIndices) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[cellRef];
      if (cell && typeof cell.v === "number") {
        cell.z = '#,##0.00 "Kg"';
      }
    }
    // Números enteros / cantidades
    for (const C of numberColIndices) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[cellRef];
      if (cell && typeof cell.v === "number") {
        cell.z = '#,##0';
      }
    }
  }

  return worksheet;
}

/**
 * Descarga un archivo de Excel con 1 o más hojas configuradas.
 */
export async function downloadExcelWorkbook(
  filename: string,
  sheets: { sheetName: string; worksheet: any }[]
) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  sheets.forEach(({ sheetName, worksheet }) => {
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  XLSX.writeFile(workbook, filename);
}
