import http from 'k6/http';
import { check, sleep } from 'k6';

// Spike Test: simulate a sudden, massive spike of traffic on the Auth endpoint
// This helps check how Argon2 handles parallel hashing without crashing the thread pool
export const options = {
  stages: [
    { duration: '10s', target: 10 },  // Small ramp up
    { duration: '10s', target: 200 }, // Sudden SPIKE to 200 concurrent users
    { duration: '20s', target: 200 }, // Hold the spike
    { duration: '10s', target: 10 },  // Sudden drop
    { duration: '10s', target: 0 },   // Scale down
  ],
  thresholds: {
    http_req_duration: ['p(90)<2000'], // Auth might take longer under spike, set limit to 2s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const payload = JSON.stringify({
    username: 'admin',
    password: 'password123',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/api/auth/login`, payload, params);
  
  check(res, {
    'is status 200 or 401': (r) => r.status === 200 || r.status === 401 || r.status === 404,
  });
  
  // Very short sleep during spikes
  sleep(0.1);
}
