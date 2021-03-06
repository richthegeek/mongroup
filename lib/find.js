// Generated by CoffeeScript 1.7.1
(function() {
  var BatchCursor, async, batchRunner, batchable, collectionKey, filterProjection, group, matchCriteria, mergeCriteria, mergeProjections, mongo;

  mongo = require('mongodb');

  async = require('async');

  batchRunner = function(queries, callback) {
    var i, iterator, query, set, sets, _i, _len, _name;
    sets = {};
    for (_i = 0, _len = queries.length; _i < _len; _i++) {
      query = queries[_i];
      if (sets[_name = collectionKey(query.collection)] == null) {
        sets[_name] = [];
      }
      sets[collectionKey(query.collection)].push(query);
    }
    iterator = function(set, next) {
      var criteria, projection, shouldFilter, _ref;
      criteria = mergeCriteria(set.map(function(query) {
        return query.criteria;
      }));
      _ref = mergeProjections(set.map(function(query) {
        return query.projection;
      })), projection = _ref[0], shouldFilter = _ref[1];
      return module.exports["super"].call(set[0].collection, criteria, projection, function(err, cursor) {
        if (err) {
          return next(err);
        }
        return cursor.each(function(err, item) {
          if (err) {
            return set.forEach(function(query) {
              return query.error(err);
            });
          } else if (item) {
            return set.forEach(function(query) {
              if (matchCriteria(query.criteria, item)) {
                if (shouldFilter) {
                  return query.push(filterProjection(query.projection, item));
                } else {
                  return query.push(item);
                }
              }
            });
          } else {
            set.forEach(function(query) {
              return query.finish();
            });
            return next();
          }
        });
      });
    };
    return async.each((function() {
      var _results;
      _results = [];
      for (i in sets) {
        set = sets[i];
        _results.push(set);
      }
      return _results;
    })(), iterator, callback);
  };

  group = async.cargo(batchRunner, 100);

  BatchCursor = (function() {
    function BatchCursor(collection, criteria, projection) {
      this.collection = collection;
      this.criteria = criteria;
      this.projection = projection;
      this.__skip = false;
      Object.keys(mongo.Cursor.prototype).forEach((function(_this) {
        return function(method) {
          return _this[method] != null ? _this[method] : _this[method] = function(val) {
            return this.ungroup()[method](val);
          };
        };
      })(this));
      this.callbacks = {
        toArray: [],
        each: [],
        count: []
      };
      this.data = [];
    }

    BatchCursor.prototype.ungroup = function(callback) {
      this.__skip = true;
      return module.exports["super"].call(this.collection, this.criteria, this.projection, callback);
    };

    BatchCursor.prototype.fields = function(projection) {
      this.projection = projection;
      return this;
    };

    BatchCursor.prototype.toArray = function(cb) {
      return this.callbacks.toArray.push(cb);
    };

    BatchCursor.prototype.each = function(cb) {
      return this.callbacks.each.push(cb);
    };

    BatchCursor.prototype.nextObject = function(cb) {
      return this.callbacks.nextObject.push(cb);
    };

    BatchCursor.prototype.error = function(err) {
      var cb, _i, _j, _len, _len1, _ref, _ref1, _results;
      if (err) {
        _ref = this.callbacks.toArray;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          cb = _ref[_i];
          cb(err);
        }
        _ref1 = this.callbacks.each;
        _results = [];
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          cb = _ref1[_j];
          _results.push(cb(err));
        }
        return _results;
      }
    };

    BatchCursor.prototype.push = function(item) {
      var cb, _i, _len, _ref, _results;
      this.data.push(item);
      _ref = this.callbacks.each;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        cb = _ref[_i];
        _results.push(cb(null, item));
      }
      return _results;
    };

    BatchCursor.prototype.finish = function() {
      var cb, _i, _len, _ref, _results;
      _ref = this.callbacks.toArray;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        cb = _ref[_i];
        _results.push(cb(null, this.data));
      }
      return _results;
    };

    return BatchCursor;

  })();

  module.exports = function(criteria, projection, callback) {
    var cursor;
    if (typeof projection === 'function') {
      callback = projection;
    }
    if (typeof projection !== 'object') {
      projection = {};
    }
    cursor = new BatchCursor(this, criteria, projection);
    if (!batchable(criteria, projection)) {
      return cursor.ungroup(callback);
    }
    setTimeout((function() {
      if (!cursor.__skip) {
        return group.push(cursor, cursor.error.bind(cursor));
      }
    }), 10);
    if (callback) {
      return callback(null, cursor);
    } else {
      return cursor;
    }
  };

  collectionKey = function(collection) {
    return collection.db.databaseName + ':' + collection.collectionName;
  };

  batchable = function(criteria, projection) {
    return true;
  };

  mergeCriteria = function(criteria) {
    var fields, k, key, unique, value, values, _i, _len;
    fields = {};
    criteria.forEach(function(crit) {
      var key, val, _results;
      _results = [];
      for (key in crit) {
        val = crit[key];
        if (fields[key] == null) {
          fields[key] = [];
        }
        _results.push(fields[key].push(val));
      }
      return _results;
    });
    for (key in fields) {
      values = fields[key];
      if (values.length > 1) {
        unique = {};
        for (_i = 0, _len = values.length; _i < _len; _i++) {
          value = values[_i];
          unique[value] = value;
        }
        values = (function() {
          var _results;
          _results = [];
          for (k in unique) {
            value = unique[k];
            _results.push(value);
          }
          return _results;
        })();
        if (true || values.length > 1) {
          fields[key] = {
            $in: values
          };
        } else {
          fields[key] = values[0];
        }
      }
    }
    return fields;
  };

  mergeProjections = function(projections) {
    var count, k, key, keys, proj, result, shouldFilter, v, _i, _j, _len, _len1;
    result = {};
    for (_i = 0, _len = projections.length; _i < _len; _i++) {
      proj = projections[_i];
      keys = (function() {
        var _results;
        _results = [];
        for (k in proj) {
          v = proj[k];
          if (v) {
            _results.push(k);
          }
        }
        return _results;
      })();
      if (keys.length === 0) {
        return [{}, true];
      }
      for (_j = 0, _len1 = keys.length; _j < _len1; _j++) {
        key = keys[_j];
        result[key] = (result[key] || 0) + 1;
      }
    }
    shouldFilter = false;
    for (key in result) {
      count = result[key];
      result[key] = 1;
      if (count !== projections.length) {
        shouldFilter = true;
      }
    }
    return [result, shouldFilter];
  };

  matchCriteria = function(criteria, item) {
    var key, val;
    for (key in criteria) {
      val = criteria[key];
      if (item[key] !== val) {
        return false;
      }
    }
    return true;
  };

  filterProjection = function(projection, item) {
    var copy, k, key, keys, v, _i, _len;
    keys = (function() {
      var _results;
      _results = [];
      for (k in projection) {
        v = projection[k];
        if (v) {
          _results.push(k);
        }
      }
      return _results;
    })();
    if (keys.length === 0) {
      return item;
    }
    keys.push('_id');
    copy = {};
    for (_i = 0, _len = keys.length; _i < _len; _i++) {
      key = keys[_i];
      copy[key] = item[key];
    }
    return copy;
  };

}).call(this);
