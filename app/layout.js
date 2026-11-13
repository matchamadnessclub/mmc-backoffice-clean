import './globals.css';

export const metadata = {
  title: 'MMC หลังร้าน',
  description: 'ระบบหลังร้าน: สต๊อก ต้นทุน และบัญชี',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
