const admin = require('firebase-admin');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { service } = require('./editor-core.cjs');
admin.initializeApp();
exports.publishEditorialCalendar = onSchedule({schedule:'every 1 minutes',timeZone:'UTC',region:'us-central1',timeoutSeconds:540,memory:'256MiB',maxInstances:1,retryCount:2},async()=>{
  await service({admin,db:admin.firestore(),bucket:admin.storage().bucket()}).tick();
});
