import { planfixRequest } from "../helpers.js";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type RequestData = Record<string, unknown> | undefined;

interface PlanfixResponse<T = unknown> {
  result?: "ok" | "fail";
  error?: string;
  objects?: T[];
  [key: string]: unknown;
}

export class PlanfixClient {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = ""; // Base URL is handled by planfixRequest
  }

  /**
   * Make a request to Planfix API
   * @param method HTTP method (GET, POST, etc.)
   * @param path API endpoint path (without /rest/ prefix)
   * @param data Request body (for POST/PUT/PATCH) or query params (for GET)
   */
  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    data?: RequestData,
  ): Promise<T> {
    try {
      console.log(`[PlanfixClient] ${method} ${path}`, data ? "with data" : "");

      // For GET requests, use data as query params
      if (method === "GET") {
        return (await planfixRequest({ path, body: data, method: "GET" })) as T;
      }
      // For POST/PUT/DELETE/PATCH, use data as request body
      else if (method === "POST") {
        return (await planfixRequest({
          path,
          body: data,
          method: "POST",
        })) as T;
      }
      // For other methods, convert to POST with _method parameter
      else {
        const requestData = {
          ...data,
          _method: method,
        };
        return (await planfixRequest({
          path,
          body: requestData,
          method: "POST",
        })) as T;
      }
    } catch (error) {
      console.error(`[PlanfixClient] Request to ${path} failed:`, error);
      throw error;
    }
  }

  // Convenience methods for common HTTP methods
  async get<T = unknown>(path: string, params?: RequestData): Promise<T> {
    return this.request<T>("GET", path, params);
  }

  async post<T = unknown>(path: string, data?: RequestData): Promise<T> {
    return this.request<T>("POST", path, data);
  }

  async put<T = unknown>(path: string, data?: RequestData): Promise<T> {
    return this.request<T>("PUT", path, data);
  }

  async delete<T = unknown>(path: string, data?: RequestData): Promise<T> {
    return this.request<T>("DELETE", path, data);
  }

  async patch<T = unknown>(path: string, data?: RequestData): Promise<T> {
    return this.request<T>("PATCH", path, data);
  }
}

// Create and export a singleton instance
export const planfixClient = new PlanfixClient();

// Helper function to test the client
export async function testPlanfixClient() {
  try {
    console.log("Testing Planfix client...");

    // Test GET request - get current user
    const me = await planfixClient.get("user/current");
    console.log("Current user:", me);

    // Test POST request - search for objects
    const objectsResponse = await planfixClient.post<
      PlanfixResponse<{ id: number; name: string }>
    >("object/list", {
      filters: [
        {
          type: 1,
          operator: "equal",
          value: "Продажа",
        },
      ],
    });

    const objects = objectsResponse.objects || [];
    console.log("Objects found:", objects.length);

    return {
      success: true,
      user: me,
      objects,
    };
  } catch (error) {
    console.error("Planfix client test failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Example usage:
// import { planfixClient } from './lib/planfix-client';
// const result = await planfixClient.get('task/123');
// const createResult = await planfixClient.post('task/', { name: 'New Task' });
