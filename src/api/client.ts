import axios, { AxiosError } from "axios";

const apiClient = axios.create({
  baseURL: window.location.origin,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Response Interceptor: Global Error Handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    // 2. Handle 403 Permission Denied
    if (error.response?.status === 403) {
      console.warn("[API] Permission denied:", error.response.data?.detail);
    }

    // 3. Handle 404 and Network Errors
    if (!error.response) {
      console.error("[API] Connection error. Please check your network.");
    } else if (error.response.status === 404) {
      console.warn("[API] Requested resource not found.");
    }

    return Promise.reject(error);
  },
);

export default apiClient;
