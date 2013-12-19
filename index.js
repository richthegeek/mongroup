find = require('./lib/find');

module.exports = function(mongo) {
	Collection = mongo.Collection

	find.super = Collection.prototype.find
	Collection.prototype.find = find

	return mongo;
}
