
import { useState, useCallback, useRef } from 'react';
import { getApiBaseUrl } from '@/constants/config';
import { useMaintenance } from '@/context/MaintenanceContext';

const getApiUrl = () => `${getApiBaseUrl()}/api`;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadingRef = useRef(false);
  const errorRef   = useRef<string | null>(null);

  const { setMaintenance } = useMaintenance();

  const request = useCallback(async <T,>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> => {
    loadingRef.current = true;
    setLoading(true);
    errorRef.current = null;
    setError(null);

    try {
      const response = await fetch(`${getApiUrl()}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // ── Maintenance mode detection ─────────────────────────────────────────
      if (response.status === 503) {
        const data = await response.json().catch(() => ({}));
        if (data.maintenance) {
          setMaintenance(true);
          const err = 'Platform is under maintenance.';
          setError(err);
          return { success: false, error: err, message: err };
        }
      }

      // Clear maintenance flag on any successful response
      setMaintenance(false);

      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response received:', text.substring(0, 200));
        throw new Error('Server returned an invalid response. The backend might be down or restarting.');
      }

      const jsonData = await response.json();

      if (!response.ok) {
        throw new Error(jsonData.message || 'API request failed');
      }

      loadingRef.current = false;
      setLoading(false);

      const responseData = jsonData.data !== undefined ? jsonData.data : jsonData;

      return {
        success: jsonData.success ?? true,
        data: responseData as T,
        message: jsonData.message,
      };
    } catch (err: any) {
      const errorMessage = err.message || 'Network error';
      errorRef.current = errorMessage;
      setError(errorMessage);
      loadingRef.current = false;
      setLoading(false);
      return { success: false, error: errorMessage, message: errorMessage };
    }
  }, [setMaintenance]);

  const get = useCallback(<T,>(endpoint: string, paramsOrToken?: Record<string, any> | string, token?: string) => {
    let url = endpoint;
    let authToken: string | undefined = token;

    if (typeof paramsOrToken === 'string') {
      authToken = paramsOrToken;
    } else if (paramsOrToken && typeof paramsOrToken === 'object' && Object.keys(paramsOrToken).length > 0) {
      const queryString = Object.entries(paramsOrToken)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');
      url = `${endpoint}?${queryString}`;
    }

    return request<T>(url, {
      method: 'GET',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });
  }, [request]);

  const post = useCallback(<T,>(endpoint: string, body: any, token?: string) => {
    return request<T>(endpoint, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(body),
    });
  }, [request]);

  const put = useCallback(<T,>(endpoint: string, body: any, token?: string) => {
    return request<T>(endpoint, {
      method: 'PUT',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(body),
    });
  }, [request]);

  const patch = useCallback(<T,>(endpoint: string, body: any, token?: string) => {
    return request<T>(endpoint, {
      method: 'PATCH',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(body),
    });
  }, [request]);

  const del = useCallback(<T,>(endpoint: string, token?: string, body?: any) => {
    return request<T>(endpoint, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }, [request]);

  return { get, post, put, patch, del, loading, error };
}
