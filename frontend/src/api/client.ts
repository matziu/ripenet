import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Get CSRF token from cookie
function getCsrfToken(): string | null {
  const match = document.cookie.match(/csrftoken=([^;]+)/)
  return match ? match[1] : null
}

apiClient.interceptors.request.use((config) => {
  const token = getCsrfToken()
  if (token && config.method !== 'get') {
    config.headers['X-CSRFToken'] = token
  }
  return config
})

// If a mutating request gets 403 and we have no CSRF token, fetch one and retry
apiClient.interceptors.response.use(undefined, async (error) => {
  const original = error.config
  if (
    error.response?.status === 403 &&
    !original._csrfRetry &&
    original.method !== 'get'
  ) {
    original._csrfRetry = true
    // Hit the login endpoint with GET to obtain the CSRF cookie
    await apiClient.get('/auth/login/')
    const token = getCsrfToken()
    if (token) {
      original.headers['X-CSRFToken'] = token
      return apiClient(original)
    }
  }
  return Promise.reject(error)
})

export default apiClient
