An experiment in grouped mongo reads.

Assume we perform a bunch of reads in parralel on the same table. For example, 500 queries all picking certain IDs.

Normally, these will all perform separate network trips, and all the other overheads.

This script attempts to group together these reads (using async.cargo) to reduce that overhead.

Preliminary results (only selecting on ID, with a simple projection) are good: between 30% and 50% speed improvements on result sets up to ~8000 items.

NOTES:
 * This is not ready for production use.
 * This will not, in final version (if it ever gets that far) actually override the collection.find method
 * It's really stupid at the moment. Any use of $whatever operators in the query will break it.
