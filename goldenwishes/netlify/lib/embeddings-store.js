/* Vectors for wishes approved after the static cache (js/data/offer-embeddings.json) was built.
 * Stored in Netlify Blobs (store "wish-embeddings"), because gw_app cannot add a pgvector column.
 */
const { getStore, connectLambda } = require('@netlify/blobs');

function store(event) {
    if (event && event.blobs) connectLambda(event);
    return getStore('wish-embeddings');
}

module.exports = { store };
