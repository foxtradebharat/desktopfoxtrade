import fs from 'fs';

const csv = fs.readFileSync('D:/tradeontip/foxtrade_nexus_40_clean_trades.csv', 'utf8');
const script = `(() => {
  const file = new File([${JSON.stringify(csv)}], 'foxtrade_nexus_40_clean_trades.csv', { type: 'text/csv' });
  const dt = new DataTransfer();
  dt.items.add(file);
  const input = document.querySelector('input[type="file"]');
  if (!input) return 'no input';
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  const privacyBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Data Privacy'));
  if (privacyBtn) privacyBtn.click();
  return 'dispatched';
})()`;

fs.writeFileSync('C:/Users/iMAC/.gemini/antigravity/brain/1bafdf96-df46-435e-a09d-733d4d69e9ad/scratch/inject_nexus_40.js', script);
console.log('Script written');
