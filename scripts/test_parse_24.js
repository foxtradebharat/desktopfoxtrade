import fs from 'fs';
import { parseBrokerCsv } from '../src/utils/tradeImportEngine.js';

const csv = fs.readFileSync('D:/tradeontip/foxtrade_nexus_40_clean_trades.csv', 'utf8');
const trades = parseBrokerCsv(csv, 500000);
const t24 = trades.find(t => t.tradeNo === 24);
console.log('Trade 24 tsl from parseBrokerCsv:', t24.tsl);
