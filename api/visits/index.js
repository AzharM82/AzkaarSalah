const https = require('https');

function httpJson(url, method = 'GET') {
  return new Promise((resolve) => {
    const req = https.request(url, { method }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (_) {
          resolve({ status: res.statusCode, data: {} });
        }
      });
    });
    req.on('error', () => resolve({ status: 500, data: {} }));
    req.end();
  });
}

module.exports = async function (context, req) {
  const namespace = 'azkaaraftersalah';
  const key = 'supplication_total_visits';

  try {
    if (req.method === 'GET') {
      const { status, data } = await httpJson(`https://api.countapi.xyz/get/${namespace}/${key}`, 'GET');
      context.res = {
        status: status === 200 ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
        body: { value: data.value ?? null }
      };
      return;
    }

    if (req.method === 'POST') {
      const { status, data } = await httpJson(`https://api.countapi.xyz/hit/${namespace}/${key}`, 'GET');
      context.res = {
        status: status === 200 ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
        body: { value: data.value ?? null }
      };
      return;
    }

    context.res = { status: 405, body: 'Method Not Allowed' };
  } catch (e) {
    context.res = { status: 500, body: 'Server Error' };
  }
};
