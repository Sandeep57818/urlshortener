// backend/src/types/index.ts
import { Request } from "express";

export interface AuthPayload {
  userId: string;
  email: string;
  role: "USER" | "ADMIN";
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export interface CreateUrlInput {
  originalUrl: string;
  customCode?: string;
  expiresAt?: string;
  title?: string;
  customDomain?: string;
}

export interface ClickData {
  urlId: string;
  ip?: string;
  userAgent?: string;
  referer?: string;
  country?: string;
  city?: string;
  browser?: string;
  os?: string;
  device?: string;
}

export interface AnalyticsOverview {
  totalClicks: number;
  uniqueVisitors: number;
  topCountries: { country: string; count: number }[];
  topReferers: { referer: string; count: number }[];
  clicksByDay: { date: string; clicks: number }[];
  browsers: { browser: string; count: number }[];
  devices: { device: string; count: number }[];
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
