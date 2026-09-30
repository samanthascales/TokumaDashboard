import type { Dict } from '..';

// English is the source text used as keys, so only plural forms are listed here.
export const en: Dict = {
  '{count} at reorder point': { one: '{count} at reorder point', other: '{count} at reorder point' },
  '{count} businesses': { one: '{count} business', other: '{count} businesses' },
  '{count} countries': { one: '{count} country', other: '{count} countries' },
  '{count} criteria left to reach {name}': { one: '{count} criterion left to reach {name}', other: '{count} criteria left to reach {name}' },
  '{count} days': { one: '{count} day', other: '{count} days' },
  '{count} high-risk suppliers': { one: '{count} high-risk supplier', other: '{count} high-risk suppliers' },
  '{count} need restock': { one: '{count} needs restock', other: '{count} need restock' },
  '{count} products · circularity is scored from each bill of materials': {
    one: '{count} product · circularity is scored from each bill of materials',
    other: '{count} products · circularity is scored from each bill of materials',
  },
  '{count} products below low-stock threshold': { one: '{count} product below low-stock threshold', other: '{count} products below low-stock threshold' },
  '{count} results': { one: '{count} result', other: '{count} results' },
  '{count} rows': { one: '{count} row', other: '{count} rows' },
  '{count} SKUs': { one: '{count} SKU', other: '{count} SKUs' },
  '{count} suppliers': { one: '{count} supplier', other: '{count} suppliers' },
  '{count} transactions': { one: '{count} transaction', other: '{count} transactions' },
  '{count} units': { one: '{count} unit', other: '{count} units' },
  '{count} units left (threshold {threshold}).': { one: '{count} unit left (threshold {threshold}).', other: '{count} units left (threshold {threshold}).' },
  '{count} units on hand ≈ {days} days of cover at your current sales rate.': {
    one: '{count} unit on hand ≈ {days} days of cover at your current sales rate.',
    other: '{count} units on hand ≈ {days} days of cover at your current sales rate.',
  },
  '{count} units on hand.': { one: '{count} unit on hand.', other: '{count} units on hand.' },
  '{count} units sold in the last 30 days': { one: '{count} unit sold in the last 30 days', other: '{count} units sold in the last 30 days' },
  '{name} needs {count} days to deliver.': { one: '{name} needs {count} day to deliver.', other: '{name} needs {count} days to deliver.' },
  '+{count} units': { one: '+{count} unit', other: '+{count} units' },
  'A short description helps investors ({count} more characters)': {
    one: 'A short description helps investors ({count} more character)',
    other: 'A short description helps investors ({count} more characters)',
  },
  'Import {count} sales': { one: 'Import {count} sale', other: 'Import {count} sales' },
  'Import {count} transactions': { one: 'Import {count} transaction', other: 'Import {count} transactions' },
  'Imported {count} sales': { one: 'Imported {count} sale', other: 'Imported {count} sales' },
  'Imported {count} transactions': { one: 'Imported {count} transaction', other: 'Imported {count} transactions' },
  'Lead time {count} days (from this supplier)': { one: 'Lead time {count} day (from this supplier)', other: 'Lead time {count} days (from this supplier)' },
  'Receive {count} units': { one: 'Receive {count} unit', other: 'Receive {count} units' },
  'Review {count} rows': { one: 'Review {count} row', other: 'Review {count} rows' },
  'Suggested order: {count} units.': { one: 'Suggested order: {count} unit.', other: 'Suggested order: {count} units.' },
  'Suggested: {count} units (covers lead time + 30 days of your sales + safety stock)': {
    one: 'Suggested: {count} unit (covers lead time + 30 days of your sales + safety stock)',
    other: 'Suggested: {count} units (covers lead time + 30 days of your sales + safety stock)',
  },
  'Win back {count} at-risk customers': { one: 'Win back {count} at-risk customer', other: 'Win back {count} at-risk customers' },
};
