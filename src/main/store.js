const Store = require('electron-store');

const store = new Store({
  name: 'chair-widget-config',
  encryptionKey: 'chair-widget-2024-secure',
  defaults: {
    supabaseUrl: 'https://mpcbpjexustvcsxntpze.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wY2JwamV4dXN0dmNzeG50cHplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NjE5NTUsImV4cCI6MjA1NzIzNzk1NX0.S5YrYxdEogy7K8FzdELqxtrsMZf4FlPBkUEJPd3circ',
    mode: 'landscape', // landscape | portrait
    doctorId: null, // 선택된 원장 ID
    doctorCallEnabled: true,
    windowPosition: null // { x, y } - 마지막 창 위치 저장
  }
});

module.exports = store;
