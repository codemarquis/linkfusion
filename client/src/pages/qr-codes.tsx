import EnhancedQrCodes from "@/components/enhanced-qr-codes";

export default function QrCodes() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">QR codes</h1>
        <p className="text-muted-foreground">Every short link has a QR code. Style it and download it as PNG or SVG.</p>
      </div>
      <EnhancedQrCodes />
    </div>
  );
}
