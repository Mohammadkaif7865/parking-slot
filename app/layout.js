import "./globals.css";

export const metadata = {
  title: "Smart Parking Map Booking Demo",
  description: "Demo booking flow using exported AutoCAD parking maps."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
