import { cookies } from "next/headers";
import { signToken, verifyToken } from "./utils";

const ADMIN_COOKIE = "fc_admin";
const FAN_COOKIE = "fc_fan";

export async function createFanSession(fanId: string) {
  const cookieStore = await cookies();
  cookieStore.set(FAN_COOKIE, signToken(fanId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearFanSession() {
  const cookieStore = await cookies();
  cookieStore.delete(FAN_COOKIE);
}

export async function getCurrentFanId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(FAN_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return payload;
}

export async function isAdminAuthed(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  return verifyToken(token) === "admin";
}

export async function createAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, signToken("admin"), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}