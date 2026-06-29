import "./globals.css";

export const metadata = {
  title: "Knockout Predictor powered by RT",
  description: "Invite-only World Cup knockout prediction league powered by RT."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
