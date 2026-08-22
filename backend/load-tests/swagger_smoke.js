import http from 'k6/http';
import { check, sleep } from 'k6';

// Swagger-driven Smoke Test
// In a real scenario with a specific k6 swagger plugin (like k6-generator), this file is auto-generated.
// Here we write a dynamic runner that would parse the spec and hit the endpoints.

export const options = {
  vus: 1,
  duration: '10s',
  thresholds: {
    http_req_failed: ['rate<0.1'], // Allowed some failures for unimplemented endpoints, but generally should pass
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5172';

// List of critical endpoints extracted from openapi.yaml
const endpoints = [
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/api/auth/me' },
  { method: 'GET', path: '/api/docker/containers' },
  { method: 'GET', path: '/api/store/apps' }
];

export default function () {
  for (const endpoint of endpoints) {
    let res;
    if (endpoint.method === 'GET') {
      res = http.get(`${BASE_URL}${endpoint.path}`);
    }
    
    // We expect the server to at least not crash (no 500s).
    // 401 is fine if we aren't passing a token, 404 is fine if not implemented yet.
    check(res, {
      [`${endpoint.method} ${endpoint.path} is not 500`]: (r) => r.status !== 500,
    });
    
    sleep(0.5);
  }
}
