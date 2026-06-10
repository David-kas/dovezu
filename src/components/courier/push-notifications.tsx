"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotifications() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    setSupported("serviceWorker" in navigator && "PushManager" in window);
  }, []);

  async function subscribe() {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const keyRes = await fetch("/api/push");
      const { publicKey } = await keyRes.json();

      if (!publicKey) {
        console.warn("VAPID keys not configured");
        return;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = subscription.toJSON();
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });

      setSubscribed(true);
    } catch (error) {
      console.error("Push subscription error:", error);
    }
  }

  if (!supported) return null;

  if (subscribed) return null;

  return (
    <div className="mb-6">
      <Button variant="outline" size="sm" onClick={subscribe}>
        <Bell className="h-4 w-4 mr-2" />
        Включить уведомления
      </Button>
    </div>
  );
}
