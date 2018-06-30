const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');

// const redisUrl = 'redis://127.0.0.1:6379';
const keys = require('../config/keys');
// const client = redis.createClient(redisUrl);
const client = redis.createClient(keys.redisUrl);

client.hget = util.promisify(client.hget);
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function(options = {}) {
  this.useCache = true;
  this.hashKey = JSON.stringify(options.key || '');
  return this;
};

mongoose.Query.prototype.exec = async function() {
  //if(this.useCache===false)
  if (!this.useCache) {
    return exec.apply(this, arguments);
  }
  //console.log('im about to run query');
  // console.log(this.getQuery());
  // console.log(this.mongooseCollection.name);
  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name
    })
  );
  //console.log(key);
  //if we have value for key
  const cacheValue = await client.hget(this.hashKey, key);

  //if we do return that
  if (cacheValue) {
    //console.log(cacheValue);
    // const doc = new this.model(JSON.parse(cacheValue));
    const doc = JSON.parse(cacheValue);
    //  console.log(this.model);
    //this.model je Blog cacheValue je title, content

    //return JSON.parse(cacheValue);
    // return doc;
    return Array.isArray(doc)
      ? doc.map(d => new this.model(d))
      : new this.model(doc);
  }
  //else issue query and store result in redis
  //return exec.apply(this, arguments);
  const result = await exec.apply(this, arguments);
  //turn  result into json  for redis
  client.hmset(this.hashKey, key, JSON.stringify(result), 'EX', 10);
  //  console.log(result);
  return result;
};

module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  }
};
