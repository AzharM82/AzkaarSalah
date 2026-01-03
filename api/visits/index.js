const { TableClient, AzureSASCredential } = require('@azure/data-tables');

// Use connection string from app setting (preferred)
function getTableClient() {
  const conn = process.env.VisitsStorageConnection;
  const tableName = 'Visits';
  if (!conn) return null;
  try {
    return TableClient.fromConnectionString(conn, tableName);
  } catch (_) {
    return null;
  }
}

async function ensureEntity(client) {
  const partitionKey = 'counter';
  const rowKey = 'total';
  try {
    const entity = await client.getEntity(partitionKey, rowKey).catch(() => null);
    if (!entity) {
      await client.createEntity({ partitionKey, rowKey, value: 0 });
      return { partitionKey, rowKey, value: 0 };
    }
    return entity;
  } catch (e) {
    throw e;
  }
}

module.exports = async function (context, req) {
  const client = getTableClient();
  if (!client) {
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'missing_connection_string' } };
    return;
  }

  try {
    if (req.method === 'GET') {
      const entity = await ensureEntity(client);
      const value = Number(entity.value || 0);
      context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { value } };
      return;
    }

    if (req.method === 'POST') {
      // Simple retry loop to handle races
      const partitionKey = 'counter';
      const rowKey = 'total';
      for (let attempt = 0; attempt < 5; attempt++) {
        const entity = await ensureEntity(client);
        const next = Number(entity.value || 0) + 1;
        try {
          await client.updateEntity({ partitionKey, rowKey, value: next, etag: entity.etag }, 'Replace');
          context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { value: next } };
          return;
        } catch (e) {
          // 412 precondition failure if ETag changed, retry
          await new Promise(r => setTimeout(r, 50 * (attempt + 1)));
        }
      }
      // Last resort: upsert
      const current = await ensureEntity(client);
      const next = Number(current.value || 0) + 1;
      await client.upsertEntity({ partitionKey: 'counter', rowKey: 'total', value: next }, 'Replace');
      context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { value: next } };
      return;
    }

    context.res = { status: 405, body: 'Method Not Allowed' };
  } catch (e) {
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'server_error', message: String(e && e.message || e) } };
  }
};
