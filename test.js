async = require('async')
mongo = require('mongodb')
mod = require('./index')

table = 'facts_session'
enabled = process.argv[2] == 'false' ? false : true

if (enabled) {
	mongo = mod(mongo)
}

console.log('Testing:', (enabled ? 'Batched' : 'Unbatched'));

mongo.MongoClient.connect('mongodb://127.0.0.1:27017/faction_account_e55f10efa848b3d3', function(err, db) {
	collection = db.collection(table);

	cur = collection.find({})
	return cur.count(console.log)

	// collection.aggregate([{"$group": {_id: null, _ids: {"$push": "$_id"}}}], function(err, results) {
	collection.aggregate([{"$limit": 100}, {"$group": {_id: null, _ids: {"$push": "$_id"}}}], function(err, results) {
		ids = results[0]._ids;

		start = Date.now()
		getter = function(id, next) {
			one = Date.now()
			collection.findOne({_id: id}, {_id: 1}, function(err, basket) {
				two = Date.now() - one
				// uncomment this to verify it works as expected
				// console.log('Got', arguments)
				next(err, two);
			});
		}

		async.map(ids, getter, function(err, times) {
			time = Date.now() - start
			min = Math.min.apply(Math, times)
			max = Math.max.apply(Math, times)
			avg = times.reduce(function (a, b) { return a + b }) / times.length

			console.log('Test completed:', (enabled ? 'Batched' : 'Unbatched'));
			console.log('\t', ids.length, 'rows');
			console.log('\t', time, 'ms');
			console.log('\t', [min, avg, max].join(' / '), 'latency')

			process.exit()
		})

	})
})
