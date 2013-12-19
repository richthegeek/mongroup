async = require 'async'

batchRunner = (queries, callback) ->
	# split the finds into separate collection sets
	# this should, in future, be done in a more intelligent way taking into account:
	#  - exclusive/expansive operators like $gt/$lt
	#  - skips, limits, sorts.
	sets = {}
	for query in queries
		sets[collectionKey query.collection] ?= []
		sets[collectionKey query.collection].push query

	iterator = (set, next) ->
		criteria = mergeCriteria set.map (query) -> query.criteria
		[projection, shouldFilter] = mergeProjections set.map (query) -> query.projection

		# console.log criteria

		module.exports.super.call set[0].collection, criteria, projection, (err, cursor) ->
			if err then return next err
			cursor.each (err, item) ->
				if err
					set.forEach (query) -> query.error err
				else if item
					set.forEach (query) ->
						if matchCriteria query.criteria, item
							if shouldFilter
								query.push filterProjection query.projection, item
							else
								query.push item
				else
					set.forEach (query) -> query.finish()
					next()

	# execute each of these separately
	async.each (set for i, set of sets), iterator, callback

# a limit of 100 seems to work fairly well. Should be tunable?
# - 50 is somewhat slower
# - 150 is markedly slower
group = async.cargo batchRunner, 100

class BatchCursor
	constructor: (@collection, @criteria, @projection) ->
		@callbacks =
			toArray: []
			each: []
			count: []
		@data = []

	toArray: (cb) ->
		@callbacks.toArray.push cb

	each: (cb) ->
		@callbacks.each.push cb

	error: (err) ->
		if err
			cb(err) for cb in @callbacks.toArray
			cb(err) for cb in @callbacks.each

	push: (item) ->
		@data.push item
		cb null, item for cb in @callbacks.each

	finish: () ->
		cb null, @data for cb in @callbacks.toArray

module.exports = (criteria, projection, callback) ->
	if typeof projection is 'function'
		callback = projection

	if typeof projection isnt 'object'
		projection = {}

	if not batchable criteria, projection
		return module.exports.super.call(this, criteria, projection, callback)

	cursor = new BatchCursor(this, criteria, projection)

	group.push cursor, cursor.error.bind(cursor)

	if callback
		callback null, cursor
	else
		return cursor


collectionKey = (collection) -> collection.db.databaseName + ':' + collection.collectionName

# simple criteria for now, expand this later
batchable = (criteria, projection) ->
	return true
	# keys = Object.keys criteria
	# return keys.length is 1

mergeCriteria = (criteria) ->

	fields = {}
	criteria.forEach (crit) ->
		for key, val of crit
			fields[key] ?= []
			fields[key].push val

	for key, values of fields
		# convert queries with multiple values in to $in queries
		if values.length > 1
			# but first, reduce to unique values only
			unique = {}
			unique[value] = value for value in values
			values = (value for k, value of unique)
			# and we might not even need an $in
			if true or values.length > 1
				fields[key] = $in: values
			else
				fields[key] = values[0]

	return fields

mergeProjections = (projections) ->
	result = {}
	for proj in projections
		keys = (k for k, v of proj when v)
		# shortcut out if we can't do a limited projection
		if keys.length is 0
			return [{}, true]

		for key in keys
			result[key] = (result[key] or 0) + 1

	shouldFilter = false
	for key, count of result
		result[key] = 1
		if count isnt projections.length
			shouldFilter = true

	return [result, shouldFilter]

matchCriteria = (criteria, item) ->
	for key, val of criteria
		if item[key] isnt val
			return false

	return true

filterProjection = (projection, item) ->
	# Note: Object.keys is slow!
	keys = (k for k, v of projection when v)
	return item if keys.length is 0

	keys.push '_id'
	copy = {}
	for key in keys
		copy[key] = item[key]

	return copy
