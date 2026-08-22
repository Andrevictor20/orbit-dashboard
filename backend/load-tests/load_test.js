import http from 'k6/http';
import { check, sleep } from 'k6';

// Load test: simulates a normal day's traffic
export const options = {
  stages: [
    { duration: '30s', target: 20 },  // simulate ramp-up of traffic from 1 to 20 users over 30s
    { duration: '1m', target: 20 },   // stay at 20 users for 1 minute
    { duration: '30s', target: 0 },   // ramp-down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'], // less than 1% of errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const res = http.get(`${BASE_URL}/`);
  
  check(res, {
    'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
  });
  
  sleep(1);
}
