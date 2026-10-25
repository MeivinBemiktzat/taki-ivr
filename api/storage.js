'use strict';
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { AsyncLocalStorage } = require('node:async_hooks');
const ctx = new AsyncLocalStorage();
const namespace=process.env.HF_NAMESPACE, bucket=process.env.HF_BUCKET;
let client;
function s3(){if(!namespace||!bucket||!process.env.HF_S3_ACCESS_KEY_ID||!process.env.HF_S3_SECRET_ACCESS_KEY)throw Error('HF storage configuration missing');return client ||= new S3Client({endpoint:'https://s3.hf.co/'+encodeURIComponent(namespace),region:'us-east-1',forcePathStyle:true,credentials:{accessKeyId:process.env.HF_S3_ACCESS_KEY_ID,secretAccessKey:process.env.HF_S3_SECRET_ACCESS_KEY},requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED',maxAttempts:2});}
function key(k){return 'taki/'+encodeURIComponent(k)+'.json';}
function run(fn){return ctx.run(new Map(),fn);}
async function get(k){try{const r=await s3().send(new GetObjectCommand({Bucket:bucket,Key:key(k)}));ctx.getStore()?.set(k,r.ETag);return JSON.parse(await r.Body.transformToString());}catch(e){if(e.name==='NoSuchKey'||e.$metadata?.httpStatusCode===404){ctx.getStore()?.set(k,null);return null;}throw e;}}
async function put(k,value){const m=ctx.getStore();if(!m?.has(k))throw Error('Read required before write');const etag=m.get(k);try{await s3().send(new PutObjectCommand({Bucket:bucket,Key:key(k),Body:JSON.stringify(value),ContentType:'application/json',...(etag?{IfMatch:etag}:{IfNoneMatch:'*'})}));m.delete(k);}catch(e){if([409,412].includes(e.$metadata?.httpStatusCode))throw Object.assign(Error('Concurrent update'),{code:'CONFLICT'});throw e;}}
module.exports={run,get,put};
