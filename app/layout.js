import "./globals.css";

export const metadata = {
  title: "Shreeji Plaza Parking",
  description: "Shreeji Plaza parking booking and slot management.",
  icons: {
    icon: "/brand/shreeji-logo.jpeg",
    shortcut: "/brand/shreeji-logo.jpeg",
    apple: "/brand/shreeji-logo.jpeg"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
