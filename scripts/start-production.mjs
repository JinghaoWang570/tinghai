import server from '../api/index.mjs';
server.listen(3000,'127.0.0.1',()=>console.log('Tinghai API listening on localhost:3000'));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
