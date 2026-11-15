




import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiClientConfig, ApiError } from '@/types';
import {
  BUILD_DATE_HEADER_KEYS,
  CPA_BUILD_DATE_HEADER_KEYS,
  CPA_SUPPORT_PLUGIN_HEADER_KEYS,
  CPA_VERSION_HEADER_KEYS,
  REQUEST_TIMEOUT_MS,
  VERSION_HEADER_KEYS,
} from '@/utils/constants';
import { computeApiUrl } from '@/utils/connection';
import { parseApiErrorResponse } from './apiError';

class ApiClient {
  private instance: AxiosInstance;
  private apiBase: string = '';
  private managementKey: string = '';
  private connectionRevision = 0;

  constructor(private readonly emitEvents: () => boolean = () => true) {
    this.instance = axios.create({
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }




  setConfig(config: ApiClientConfig): void {
    const apiBase = computeApiUrl(config.apiBase);
    if (apiBase !== this.apiBase || config.managementKey !== this.managementKey) {
      this.connectionRevision += 1;
    }
    this.apiBase = apiBase;
    this.managementKey = config.managementKey;

    if (config.timeout) {
      this.instance.defaults.timeout = config.timeout;
    } else {
      this.instance.defaults.timeout = REQUEST_TIMEOUT_MS;
    }
  }


  getConnectionRevision(): number {
    return this.connectionRevision;
  }


  captureConnection(isCurrent: () => boolean = () => true): ApiClient {
    const revision = this.connectionRevision;
    const client = new ApiClient(() => this.connectionRevision === revision && isCurrent());
    client.apiBase = this.apiBase;
    client.managementKey = this.managementKey;
    client.instance.defaults.timeout = this.instance.defaults.timeout;
    return client;
  }

  private readHeader(headers: Record<string, unknown> | undefined, keys: string[]): string | null {
    if (!headers) return null;

    const normalizeValue = (value: unknown): string | null => {
      if (value === undefined || value === null) return null;
      if (Array.isArray(value)) {
        const first = value.find(
          (entry) => entry !== undefined && entry !== null && String(entry).trim()
        );
        return first !== undefined ? String(first) : null;
      }
      const text = String(value);
      return text ? text : null;
    };

    const headerGetter = (headers as { get?: (name: string) => unknown }).get;
    if (typeof headerGetter === 'function') {
      for (const key of keys) {
        const match = normalizeValue(headerGetter.call(headers, key));
        if (match) return match;
      }
    }

    const entries =
      typeof (headers as { entries?: () => Iterable<[string, unknown]> }).entries === 'function'
        ? Array.from((headers as { entries: () => Iterable<[string, unknown]> }).entries())
        : Object.entries(headers);

    const normalized = Object.fromEntries(
      entries.map(([key, value]) => [String(key).toLowerCase(), value])
    );
    for (const key of keys) {
      const match = normalizeValue(normalized[key.toLowerCase()]);
      if (match) return match;
    }
    return null;
  }

  private readBooleanHeader(
    headers: Record<string, unknown> | undefined,
    keys: string[]
  ): boolean | null {
    const value = this.readHeader(headers, keys);
    if (value === null) return null;

    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return null;
  }




  private setupInterceptors(): void {

    this.instance.interceptors.request.use(
      (config) => {

        config.baseURL = this.apiBase;


        if (this.managementKey) {
          config.headers.Authorization = `Bearer ${this.managementKey}`;
        }

        return config;
      },
      (error) => Promise.reject(this.handleError(error))
    );


    this.instance.interceptors.response.use(
      (response) => {
        const headers = response.headers as Record<string, string | undefined>;
        const cpaVersion = this.readHeader(headers, CPA_VERSION_HEADER_KEYS);
        const cpaBuildDate = this.readHeader(headers, CPA_BUILD_DATE_HEADER_KEYS);
        const version = cpaVersion || this.readHeader(headers, VERSION_HEADER_KEYS);
        const buildDate = cpaBuildDate || this.readHeader(headers, BUILD_DATE_HEADER_KEYS);
        const supportsPlugin = this.readBooleanHeader(headers, CPA_SUPPORT_PLUGIN_HEADER_KEYS);


        if (this.emitEvents() && (version || buildDate)) {
          window.dispatchEvent(
            new CustomEvent('server-version-update', {
              detail: { version: version || null, buildDate: buildDate || null },
            })
          );
        }
        if (this.emitEvents() && supportsPlugin !== null) {
          window.dispatchEvent(
            new CustomEvent('server-plugin-support-update', {
              detail: { supportsPlugin },
            })
          );
        }

        return response;
      },
      (error) => Promise.reject(this.handleError(error))
    );
  }




  private handleError(error: unknown): ApiError {
    if (axios.isAxiosError(error)) {
      const responseData: unknown = error.response?.data;
      const parsedError = parseApiErrorResponse(responseData, error.message);
      const apiError = new Error(parsedError.message) as ApiError;
      apiError.name = 'ApiError';
      apiError.status = error.response?.status;
      apiError.code = error.code;
      apiError.apiCode = parsedError.apiCode;
      apiError.details = responseData;
      apiError.data = responseData;


      if (this.emitEvents() && error.response?.status === 401) {
        window.dispatchEvent(new Event('unauthorized'));
      }

      return apiError;
    }

    const fallbackMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unknown error occurred';
    const fallback = new Error(fallbackMessage) as ApiError;
    fallback.name = 'ApiError';
    return fallback;
  }




  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.get<T>(url, config);
    return response.data;
  }




  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.post<T>(url, data, config);
    return response.data;
  }




  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.put<T>(url, data, config);
    return response.data;
  }




  async patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.patch<T>(url, data, config);
    return response.data;
  }




  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.delete<T>(url, config);
    return response.data;
  }




  async getRaw(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    return this.instance.get(url, config);
  }




  async postForm<T = unknown>(
    url: string,
    formData: FormData,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.instance.post<T>(url, formData, {
      ...config,
      headers: {
        ...(config?.headers || {}),
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }
}


export const apiClient = new ApiClient();
