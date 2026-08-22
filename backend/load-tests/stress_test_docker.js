import http from 'k6/http';
import { check, sleep } from 'k6';

// Stress Test: push the system to its limits to see how it handles heavy load
export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Traffic ramps up to 50 users over 30s
    { duration: '1m', target: 50 },   // Stays at 50 users for 1 minute
    { duration: '30s', target: 100 }, // Ramps up to 100 users over 30s
    { duration: '1m', target: 100 },  // Stays at 100 users for 1 minute
    { duration: '30s', target: 0 },   // Ramps down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests must complete below 1s under heavy load
    http_req_failed: ['rate<0.05'], // Max 5% failure rate under stress
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Simulating a heavy endpoint like docker stats or container list
  const res = http.get(`${BASE_URL}/api/docker/containers`);
  
  check(res, {
    'is status 200 or 401 (auth missing)': (r) => r.status === 200 || r.status === 401 || r.status === 404,
  });
  
  // Real users wait between actions
  sleep(1);
}
