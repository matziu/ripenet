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

export default apiClient
