const mongoose = require('mongoose');

// Define the ship schema
const shipSchema = new mongoose.Schema({
    shipName: {
        type: String,
        required: true
    },
    routes: {
        last2Days: {
            type: {
                type: String,
                default: 'FeatureCollection'
            },
            features: [{
                type: {
                    type: String,
                    default: 'Feature'
                },
                geometry: {
                    type: {
                        type: String,
                        default: 'LineString'
                    },
                    coordinates: [[Number]]
                }
            }]
        },
        between2And7Days: {
            type: {
                type: String,
                default: 'FeatureCollection'
            },
            features: [{
                type: {
                    type: String,
                    default: 'Feature'
                },
                geometry: {
                    type: {
                        type: String,
                        default: 'LineString'
                    },
                    coordinates: [[Number]]
                }
            }]
        }
    }
});

// Create the Ship model
const ShipModel = mongoose.model('Ship', shipSchema);

module.exports = ShipModel;
