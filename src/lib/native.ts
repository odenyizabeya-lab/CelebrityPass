// Native (Android / iOS Capacitor shell) integration helpers.
// Everything here is a no-op on the plain web; each function guards on the
// Capacitor runtime being present so the web bundle stays unaffected.

import { Capacitor } from "@capacitor/core";

let cachedNative: boolean | null = null;

/** True when running inside the Capacitor mobile shell (not a plain browser). */
export function isNativePlatform(): boolean {
  if (cachedNative !== null) return cachedNative;
  cachedNative = Capacitor.isNativePlatform();
  return cachedNative;
}

/**
 * Capture a photo through the native camera/gallery UI. Returns a File usable
 * by the existing image-send pipeline + a preview URL. Throws if cancelled or
 * unavailable (callers fall back to the plain file input).
 */
export async function captureImageFromNative(): Promise<{ file: File; preview: string }> {
  if (!isNativePlatform()) throw new Error("not native");
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.Uri,
    source: CameraSource.Prompt,
    allowEditing: false,
    quality: 85,
  });
  const uri = photo.webPath ?? photo.path;
  if (!uri) throw new Error("no photo captured");
  const res = await fetch(uri);
  const blob = await res.blob();
  const file = new File([blob], `camera-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });
  return { file, preview: URL.createObjectURL(file) };
}

type PushListenerUnregister = () => Promise<void>;

/**
 * Register for native push (FCM) on the mobile shell and route notification
 * taps back into the app. Returns the unregister function (or null when not
 * native / permission denied).
 *
 * NOTE: the server-side FCM sender needs a Firebase project
 * (google-services.json + firebase-admin credentials). Token delivery is
 * intentionally deferred until that config exists; the registration + tap
 * plumbing is live now so no app change is needed later.
 */
export async function enableNativePush(
  onMessageTap: (conversationId: string) => void
): Promise<PushListenerUnregister | null> {
  if (!isNativePlatform()) return null;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      const req = await PushNotifications.requestPermissions();
      if (req.receive !== "granted") return null;
    }

    await PushNotifications.register();

    const unhandlers: Array<{ remove: () => Promise<void> }> = [
      await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const data = (action.notification?.data ?? {}) as Record<string, unknown>;
        if (typeof data.conversationId === "string" && data.conversationId) {
          onMessageTap(data.conversationId);
        }
      }),
      await PushNotifications.addListener("registration", (registration) => {
        // registration.value is the device token. Once Firebase is provisioned,
        // POST this token to the server so team replies can reach the app.
        void registration.value;
      }),
    ];
    return async () => {
      await Promise.all(unhandlers.map((h) => h.remove()));
    };
  } catch {
    return null;
  }
}