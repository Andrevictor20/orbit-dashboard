import http from 'k6/http';
import { check, sleep } from 'k6';

// Smoke test: very minimal load to ensure the system is up and can respond
export const options = {
  vus: 1, // 1 Virtual User
  duration: '10s', // Run for 10 seconds
  thresholds: {
    http_req_duration: ['p(99)<200'], // 99% of requests must complete below 200ms
    http_req_failed: ['rate<0.01'], // less than 1% of errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5172'; // Assuming Axum runs on 5172 by default

export default function () {
  // Try to hit a health check endpoint, or fallback to root if not found
  const res = http.get(`${BASE_URL}/`);
  
  check(res, {
    'status is 200 or 404': (r) => r.status === 200 || r.status === 404, // Accept 404 if root is not configured in backend
  });
  
  sleep(1);
}
