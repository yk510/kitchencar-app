import {
  groupAirregiTransactions,
  parseAirregiCsvString,
} from '@/lib/airregi-csv-parser'
import {
  CsvImportValidationError,
  type CsvImportSource,
  type CsvImportSourceBuilder,
} from '@/lib/csv-import/types'

export const buildAirregiCsvImportSource: CsvImportSourceBuilder = (csvText) => {
  const rows = parseAirregiCsvString(csvText)

  if (rows.length === 0) {
    throw new CsvImportValidationError('CSVの行が読み取れませんでした')
  }

  return groupAirregiTransactions(rows)
}
