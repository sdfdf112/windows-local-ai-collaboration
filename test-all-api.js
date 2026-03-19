const http = require('http');

function testApi(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: 3000, path, method: 'GET' }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data: data.slice(0, 200) }));
    });
    req.on('error', e => reject(e));
    req.end();
  });
}

(async () => {
  console.log('=== /api/messages ===');
  console.log(await testApi('/api/messages'));
  console.log('\n=== /api/discussions ===');
  console.log(await testApi('/api/discussions'));
  console.log('\n=== /api/dead-letters ===');
  console.log(await testApi('/api/dead-letters'));
  console.log('\n=== /api/tasks ===');
  console.log(await testApi('/api/tasks'));
})();
