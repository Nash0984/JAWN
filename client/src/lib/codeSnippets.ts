import type { APIEndpoint } from '@shared/apiEndpoints';

const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;

export interface CodeSnippet {
  language: string;
  code: string;
  label: string;
}

/**
 * Generate code snippets for API integration
 * Supports cURL, JavaScript (fetch), and Python (requests)
 */
export function generateCodeSnippets(endpoint: APIEndpoint): CodeSnippet[] {
  const snippets: CodeSnippet[] = [];

  // Build the full URL with query params if applicable
  let fullUrl = `${API_BASE_URL}${endpoint.path}`;
  if (endpoint.queryParams && endpoint.queryParams.length > 0) {
    const params = endpoint.queryParams
      .map(p => `${p.name}=${p.required ? '<value>' : '<optional>'}`)
      .join('&');
    fullUrl += `?${params}`;
  }

  // cURL snippet
  snippets.push({
    language: 'bash',
    label: 'cURL',
    code: generateCurlSnippet(endpoint, fullUrl),
  });

  // JavaScript (fetch) snippet
  snippets.push({
    language: 'javascript',
    label: 'JavaScript',
    code: generateJavaScriptSnippet(endpoint, fullUrl),
  });

  // Python (requests) snippet
  snippets.push({
    language: 'python',
    label: 'Python',
    code: generatePythonSnippet(endpoint, fullUrl),
  });

  return snippets;
}

function generateCurlSnippet(endpoint: APIEndpoint, url: string): string {
  const lines: string[] = [];
  
  lines.push(`curl -X ${endpoint.method} \\`);
  
  if (endpoint.requiresAuth) {
    lines.push(`  -H "Authorization: Bearer YOUR_API_TOKEN" \\`);
  }
  
  if (endpoint.requestBody) {
    lines.push(`  -H "Content-Type: application/json" \\`);
  }
  
  if (endpoint.requestBody) {
    const bodyJson = JSON.stringify(endpoint.requestBody, null, 2);
    const indentedBody = bodyJson.split('\n').map(line => `    ${line}`).join('\n');
    lines.push(`  -d '${indentedBody}' \\`);
  }
  
  lines.push(`  "${url}"`);
  
  return lines.join('\n');
}

function generateJavaScriptSnippet(endpoint: APIEndpoint, url: string): string {
  const lines: string[] = [];
  
  lines.push(`const response = await fetch('${url}', {`);
  lines.push(`  method: '${endpoint.method}',`);
  
  const headers: string[] = [];
  if (endpoint.requiresAuth) {
    headers.push(`    'Authorization': 'Bearer YOUR_API_TOKEN'`);
  }
  if (endpoint.requestBody) {
    headers.push(`    'Content-Type': 'application/json'`);
  }
  
  if (headers.length > 0) {
    lines.push(`  headers: {`);
    lines.push(headers.join(',\n'));
    lines.push(`  }`);
  }
  
  if (endpoint.requestBody) {
    lines.push(`${headers.length > 0 ? ',' : ''}`);
    lines.push(`  body: JSON.stringify(${JSON.stringify(endpoint.requestBody, null, 4).split('\n').map((line, i) => i === 0 ? line : `  ${line}`).join('\n')})`);
  }
  
  lines.push(`});`);
  lines.push(``);
  lines.push(`const data = await response.json();`);
  lines.push(`console.log(data);`);
  
  return lines.join('\n');
}

function generatePythonSnippet(endpoint: APIEndpoint, url: string): string {
  const lines: string[] = [];
  
  lines.push(`import requests`);
  lines.push(``);
  lines.push(`url = "${url}"`);
  
  const headers: string[] = [];
  if (endpoint.requiresAuth) {
    headers.push(`    "Authorization": "Bearer YOUR_API_TOKEN"`);
  }
  if (endpoint.requestBody) {
    headers.push(`    "Content-Type": "application/json"`);
  }
  
  if (headers.length > 0) {
    lines.push(`headers = {`);
    lines.push(headers.join(',\n'));
    lines.push(`}`);
  }
  
  if (endpoint.requestBody) {
    lines.push(``);
    lines.push(`data = ${JSON.stringify(endpoint.requestBody, null, 2).split('\n').map((line, i) => i === 0 ? line : `${line}`).join('\n')}`);
  }
  
  lines.push(``);
  
  const requestArgs: string[] = ['url'];
  if (headers.length > 0) requestArgs.push('headers=headers');
  if (endpoint.requestBody) requestArgs.push('json=data');
  
  lines.push(`response = requests.${endpoint.method.toLowerCase()}(${requestArgs.join(', ')})`);
  lines.push(`print(response.json())`);
  
  return lines.join('\n');
}
