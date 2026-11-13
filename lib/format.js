export const fmt = (n, d = 2) =>
  n === null || n === undefined || n === '' || isNaN(Number(n))
    ? '-'
    : Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d });

export const num = (v) =>
  v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v);

export const ACTION_TH = { withdraw: 'เบิกของ', receive: 'รับของเข้า', count: 'นับสต๊อก' };

export const unitTh = (u) => (u === 'pcs' ? 'ชิ้น' : u);

export const fmtTime = (iso) =>
  new Date(iso).toLocaleString('th-TH-u-ca-gregory', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });

export const OWNER_TABS = [
  { href: '/owner', label: 'สต๊อก' },
  { href: '/owner/prices', label: 'ราคาและต้นทุน' },
  { href: '/owner/staff', label: 'รายชื่อพนักงาน' },
  { href: '/staff', label: 'หน้าพนักงาน (เบิก/นับ)' },
];
