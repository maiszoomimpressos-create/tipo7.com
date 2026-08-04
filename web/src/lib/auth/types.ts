export interface SessionUser {
  id: string;
  email: string;
  fullName: string | null;
}

export interface Session {
  accessToken: string;
  expiresAt: number; // epoch ms
  user: SessionUser;
}
