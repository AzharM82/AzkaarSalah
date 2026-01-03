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
      if (status === 200 && typeof data.value === 'number') {
        context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { value: data.value } };
      } else if (status === 404) {
        // Key not created yet; report zero instead of 500
        context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { value: 0 } };
      } else {
        context.log('GET visits error', status, data);
        context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'failed_get', status } };
      }
      return;
    }

    if (req.method === 'POST') {
      let { status, data } = await httpJson(`https://api.countapi.xyz/hit/${namespace}/${key}`, 'GET');
      if (!(status === 200 && typeof data.value === 'number')) {
        // Attempt to create then hit again
        await httpJson(`https://api.countapi.xyz/create?namespace=${encodeURIComponent(namespace)}&key=${encodeURIComponent(key)}`, 'GET');
        ({ status, data } = await httpJson(`https://api.countapi.xyz/hit/${namespace}/${key}`, 'GET'));
      }
      if (status === 200 && typeof data.value === 'number') {
        context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { value: data.value } };
      } else {
        context.log('POST visits error', status, data);
        context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'failed_post', status } };
      }
      return;
    }

    context.res = { status: 405, body: 'Method Not Allowed' };
  } catch (e) {
    context.res = { status: 500, body: 'Server Error' };
  }
};
