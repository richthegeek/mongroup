async = require('async')
mongo = require('mongodb')
mod = require('./index')

table = 'facts_user'
enabled = true
// enabled = false

if (enabled) {
	mongo = mod(mongo)
}

mongo.MongoClient.connect('mongodb://127.0.0.1:27017/faction_account_e55f10efa848b3d3', function(err, db) {
	collection = db.collection(table);

	collection.aggregate([{"$limit": 1000}, {"$group": {_id: null, _ids: {"$push": "$email"}}}], function(err, results) {
		ids = results[0]._ids;

		start = Date.now()
		getter = function(id, next) {
			collection.find({email: id, "score.score": 13}, {email: 1}).toArray(function(err, basket) {
				// uncomment this to verify it works as expected
				// console.log('Got', arguments)
				next(err);
			});
		}

		async.each(ids, getter, function() {
			console.log('Test completed:', (enabled ? 'Batched' : 'Unbatched'));
			console.log('\t', ids.length, 'rows');
			console.log('\t', Date.now() - start, 'ms');
		})

	})
})
