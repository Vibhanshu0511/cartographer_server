const fs = require('fs');
const parse = require('csv-parser');
const mongoose = require('mongoose');
const ShipModel = require('./models/ship_model'); // Import your Mongoose schema
const PortModel = require('./models/port_model'); // Import your Mongoose schema
const express = require('express');
const cors=require('cors');



const app=express();

app.use(cors({

    origin: ['https://neuron-assignment-client.vercel.app/'], // Change the port to match your frontend port
    methods: ['GET', 'POST'],
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
  }));


async function processAndSaveDataShips(filePathShips) {
    const ships = {}; // Object to store ship data with arrays of coordinates
    const data_ships=[];
    // let prev=[0,0];
    // Read the CSV file and parse each row
    fs.createReadStream(filePathShips)
        .pipe(parse())
        .on('data', row => {
            const shipName = row.site_name;
            const latitude = parseFloat(row.location_latitude);
            const longitude = parseFloat(row.location_longitude);
            const timestampString = row.ec_timestamp;

            if (isNaN(latitude) || isNaN(longitude)) {
                console.warn(`Skipping entry for ${shipName} due to missing latitude or longitude.`);
                return; // Skip this entry if latitude or longitude is missing
            }

            const timestamp = new Date(Date.parse(timestampString));
            const coordinates = [parseFloat(longitude), parseFloat(latitude)]; // Convert coordinates to GeoJSON format

            if (!ships[shipName]) {
                ships[shipName] = { coordinates: [], endDate: timestamp };
            }

            ships[shipName].coordinates.unshift({ coordinates, timestamp }); // Add coordinates and timestamp to the beginning of the ship's array
        })
        .on('end', async () => {
            // Process and save ship data to MongoDB
            try {
                for (const shipName in ships) {
                    const shipData = ships[shipName];
                    // console.log(shipData);
                    
                    const twoDaysAfterStart = new Date(shipData.endDate);
                    twoDaysAfterStart.setDate(twoDaysAfterStart.getDate() - 2); // Calculate timestamp for 2 days before the ship's end date
                    const sevenDaysAfterStart = new Date(shipData.endDate);
                    sevenDaysAfterStart.setDate(sevenDaysAfterStart.getDate() - 7); // Calculate timestamp for 7 days before the ship's end date

                    const last2DaysRoute = [];
                    const between2And7DaysRoute = [];
                    let flag=[0,0];

                    shipData.coordinates.forEach(({ coordinates, timestamp }) => {

                        if (timestamp >= twoDaysAfterStart && timestamp < shipData.endDate && (coordinates[0]!=flag[0] || coordinates[1]!=flag[1]) ) {
                            last2DaysRoute.push(coordinates);
                        } else if (timestamp >= sevenDaysAfterStart && timestamp < twoDaysAfterStart && (coordinates[0]!=flag[0] || coordinates[1]!=flag[1])) {
                            between2And7DaysRoute.push(coordinates);
                        }
                        flag=coordinates;
                    });

                    data_ships.push({
                        shipName,
                        routes: {
                            last2Days: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: last2DaysRoute.reverse() }}] },
                            between2And7Days: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: between2And7DaysRoute.reverse() } }] }
                        }
                    });
                    
                }
                // console.log(data_ships)
                await ShipModel.insertMany(data_ships);

                console.log('Ship data saved successfully to MongoDB');
            } catch (error) {
                console.error('Error saving ship data to MongoDB:', error);
            }
        });
}


async function processAndSaveDataPort(filePathPorts) {
    const ports = [];

    // Read the CSV file and parse each row
    fs.createReadStream(filePathPorts)
        .pipe(parse())
        .on('data', row => {
            const portName = row.port_name;
            const latitude = parseFloat(row.geo_location_latitude);
            const longitude = parseFloat(row.geo_location_longitude);

            // Skip if any required field is missing
            if (!portName || isNaN(latitude) || isNaN(longitude)) {
                // console.warn(`Skipping entry due to missing data: ${JSON.stringify(row)}`);
                return;
            }

            // Create a new port object with GeoJSON format
            const port = {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [longitude, latitude]
                },
                properties: {
                    port_name: portName
                }
            };

            ports.push(port);
        })
        .on('end', async () => {
            // Save ports data to MongoDB
            try {
                await PortModel.insertMany(ports);
                console.log('Port data saved successfully to MongoDB');
            } catch (error) {
                console.error('Error saving port data to MongoDB:', error);
            }
        });
}



const filePathShips = './assets/geo_stats_data_7_days - geo_stats.csv';
// const filePathShips = './geo1.csv';
const filePathPorts = './assets/port.csv';

app.post('/populate_data_ship',async(req,res)=>{
    try {
       await processAndSaveDataShips(filePathShips);
       res.status(400).json({ message: 'data was added successfully' }); 
    } catch (error) {
        throw new Error(error);
    }
})

app.get('/ships', async (req, res) => {
    try {
        const ships = await ShipModel.find(); // Retrieve all ship data from the database
        res.json(ships.shipName); // Respond with the ship data as JSON
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' }); // Handle any errors
    }
});

app.get('/ships/:shipName', async (req, res) => {
    const shipName = req.params.shipName; // Get the shipName from request parameters
    try {
        const ship = await ShipModel.findOne({ shipName: shipName }); // Retrieve ship data by shipName
        if (!ship) {
            return res.status(404).json({ message: 'Ship not found' }); // Return 404 if ship is not found
        }
        res.json(ship); // Respond with the ship data as JSON
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' }); // Handle any errors
    }
});


app.post('/populate_data_port', async(req, res)=>{
    try{
        await processAndSaveDataPort(filePathPorts);
       res.status(400).json({ message: 'data was added successfully' }); 
    } catch (error) {
        throw new Error(error);
    }
})

app.get('/ports', async (req, res) => {
    try {
        const ships = await PortModel.find(); // Retrieve all ship data from the database
        res.json(ships); // Respond with the ship data as JSON
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' }); // Handle any errors
    }
});

app.get('/ports/:searchTerm', async (req, res) => {
    const searchTerm = req.params.searchTerm.toLowerCase();
    try {
        const matchingPort = await PortModel.findOne({ 'properties.port_name': { $regex: searchTerm, $options: 'i' } });
        if (matchingPort) {
            res.json(matchingPort);
        } else {
            res.status(404).json({ error: 'Port not found' });
        }
    } catch (error) {
        console.error('Error searching for port:', error);
        res.status(500).send('Internal server error');
    }
});

app.get('/ships_on_ports/:port', async (req, res) => {
    const input = req.params.port.toLowerCase();
    res.json({ message: 'ports data', input })
    try {
        const ships = await findShipsAtPort(input, 7);
        res.json(ships);
        
        res.json({ message: 'Ships found at port successfully!', ships }); // Assuming ships is an array
    } catch (error) {
        console.error('Error finding ships:', error);
        res.status(500).json({ message: 'Error finding ships at port.' });
    }

})

// Connect to MongoDB (replace connection string)
mongoose.connect('mongodb+srv://be19b035:lR2sLiB1McGwD0sl@geoship.bgezxoa.mongodb.net/?retryWrites=true&w=majority&appName=Geoship', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(()=>app.listen(8000,
()=> console.log(`app running on port : http://localhost:8000`)))
.catch(error => console.error('Error connecting to MongoDB:', error));
