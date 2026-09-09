import { describe, it, expect } from 'vitest';
import { extractPortsFromYaml, validateComposeSyntax } from '../../../components/compose/yamlValidator';

describe('yamlValidator & extractPortsFromYaml', () => {
  it('validates correct compose syntax', () => {
    const yaml = `services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
`;
    const res = validateComposeSyntax(yaml);
    expect(res.valid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('rejects empty yaml content', () => {
    const res = validateComposeSyntax('   ');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('vazio');
  });

  it('rejects yaml missing services declaration', () => {
    const yaml = `version: "3.8"
networks:
  default:
`;
    const res = validateComposeSyntax(yaml);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('services');
  });

  it('rejects tabs in yaml', () => {
    const yaml = `services:
\tweb:
\t\timage: nginx
`;
    const res = validateComposeSyntax(yaml);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Tabs');
  });

  it('extracts host ports correctly from various yaml formats', () => {
    const yaml = `services:
  app1:
    image: app1
    ports:
      - "3000:3000"
      - 8080:80
      - "127.0.0.1:9090:90"
  app2:
    image: app2
    ports:
      - "443:443"
`;
    const ports = extractPortsFromYaml(yaml);
    expect(ports).toEqual([3000, 8080, 9090, 443]);
  });

  it('returns empty array when no ports are mapped', () => {
    const yaml = `services:
  worker:
    image: background-worker
`;
    const ports = extractPortsFromYaml(yaml);
    expect(ports).toEqual([]);
  });
});
