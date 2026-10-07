import fs from 'fs';

const csv = fs.readFileSync('D:/tradeontip/nexus-50-golden-trades.csv', 'utf8');
const script = `(() => {
  const file = new File([${JSON.stringify(csv)}], 'nexus-50-golden-trades.csv', { type: 'text/csv' });
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

fs.writeFileSync('C:/Users/iMAC/.gemini/antigravity/brain/1bafdf96-df46-435e-a09d-733d4d69e9ad/scratch/inject_nexus_golden.js', script);
console.log('Golden injection script created');
