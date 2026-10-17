import { createContext } from "react-router";
import type { SessionUser } from "~/models/user.server";

/** Angemeldeter Benutzer, gesetzt von der Login-Middleware. */
export const userContext = createContext<SessionUser | null>(null);
