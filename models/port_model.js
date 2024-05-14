const mongoose = require('mongoose');

// Define the port schema
const portSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['Feature'],
        default: 'Feature'
    },
    geometry: {
        type: {
            type: String,
            enum: ['Point'],
            required: true
        },
        coordinates: {
            type: [Number],
            required: true
        }
    },
    properties: {
        port_name: {
            type: String,
            required: true
        }
    }
});

// Create the Port model
const PortModel = mongoose.model('Port', portSchema);

module.exports = PortModel;
