import { Suspense } from "react";
import { QrLoginClient } from "./qr-login-client";

export default function QrLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Загрузка...</div>}>
      <QrLoginClient />
    </Suspense>
  );
}
