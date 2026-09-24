import { API_BASE_URL } from './config';

/**
 * Custom error class for API errors.
 */
export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Builds the full URL from base URL and endpoint.
 */
function buildUrl(endpoint) {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
}

/**
 * Centralized request function.
 *
 * @param {string} endpoint - API path (e.g. '/health' or '/auth/login')
 * @param {object} [options] - Request options
 * @param {string} [options.method='GET'] - HTTP method
 * @param {any} [options.body] - Request body (object or string)
 * @param {string} [options.token] - Optional JWT bearer token
 * @param {object} [options.headers] - Additional custom headers
 * @returns {Promise<any>} - Parsed JSON response data
 */
export async function request(endpoint, options = {}) {
  const {
    method = 'GET',
    body,
    token,
    headers = {},
    ...customOptions
  } = options;

  const url = buildUrl(endpoint);

  const requestHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  if (body !== undefined && body !== null && !requestHeaders['Content-Type']) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const config = {
    method,
    headers: requestHeaders,
    ...customOptions,
  };

  if (body !== undefined && body !== null) {
    config.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (networkError) {
    throw new ApiError(
      'Network request failed. Please check server connectivity.',
      0,
      null
    );
  }

  let responseData = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      const text = await response.text();
      responseData = text ? { raw: text } : null;
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    const errorMessage =
      responseData?.message ||
      responseData?.error ||
      `Request failed with status ${response.status}`;
    throw new ApiError(errorMessage, response.status, responseData);
  }

  return responseData;
}

export const apiClient = {
  request,
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PUT', body }),
  delete: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' }),
};

export default apiClient;
