import express from 'express';
import { MongoClient, ObjectId } from 'mongodb'; // Import ObjectId for querying by ID
import dotenv from 'dotenv';
import DepartmentCost from '../models/DepartmentCost.js';
import KWHAverage from '../models/KWHAverage.js'; // Import the new KWHAverage model
import KWHParts from '../models/KWHParts.js'; // Import the KWHParts model
import ConsumptionWrtMoltenMetal from '../models/ConsumptionWrtMoltenMetel.js'; // Import the new ConsumptionWrtMoltenMetal model
import TimeZoneCost from '../models/TimeZoneCost.js'; // Add this with other imports
import DailyPFTrend from '../models/DailyPFTrend.js'; // Import DailyPFTrend model
import axios from 'axios';
import OpenAI from 'openai'; // Import OpenAI client

dotenv.config();

const router = express.Router();
const uri = process.env.MONGODB_URI; // Use your MongoDB URI from .env
const endpoint = "https://models.inference.ai.azure.com"; // Set the endpoint for the model
const modelName = process.env.LLM_MODEL; // Specify the model name

// Initialize OpenAI client
const client = new OpenAI({ baseURL: endpoint, apiKey: process.env.OPENAI_API_KEY }); // Use the OpenAI API key

// Endpoint to aggregate total cost of energy by department
router.get('/api/aggregate-energy-costs', async (req, res) => {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('Testing');
        const collection = database.collection('EnergyMonitoring');

        // Aggregate total cost of energy for each department
        const aggregatedCosts = await collection.aggregate([
            {
                $group: {
                    _id: "$Department",
                    totalCost: {
                        $sum: {
                            $toDouble: {
                                $replaceAll: {
                                    input: {
                                        $replaceOne: {
                                            input: "$Cost of Energy",
                                            find: "₹ ",
                                            replacement: ""
                                        }
                                    },
                                    find: ",",
                                    replacement: ""
                                }
                            }
                        }
                    }
                }
            }
        ]).toArray();

        // Store the aggregated results in the new schema
        await DepartmentCost.deleteMany({}); // Clear existing data if needed
        await DepartmentCost.insertMany(aggregatedCosts.map(item => ({
            department: item._id,
            totalCost: item.totalCost
        })));

        res.json({aggregatedCosts });
    } catch (error) {
        console.error('Error aggregating energy costs:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        await client.close();
    }
});

router.get('/api/avgKWH', async (req, res) => {
   const client = new MongoClient(uri);
   try {
       await client.connect();
       const database = client.db('Testing');
       const collection = database.collection('EnergyMonitoring');

       // Calculate date-wise average of KWH_Tonne for Machine IDs "IF1" and "IF2"
       const aggregatedData = await collection.aggregate([
           {
               $match: {
                   $or: [
                       { "Machine ID": "IF1" },
                       { "Machine ID": "IF2" }
                   ]
               }
           },
           {
               $group: {
                   _id: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$Date" } } }, // Convert to date
                   avgKWH_IF1: { $avg: { $cond: [{ $eq: ["$Machine ID", "IF1"] }, "$KWH_Tonne", null] } }, // Calculate average for IF1
                   avgKWH_IF2: { $avg: { $cond: [{ $eq: ["$Machine ID", "IF2"] }, "$KWH_Tonne", null] } }  // Calculate average for IF2
               }
           },
           {
               $sort: { "_id": 1 } // Sort by date in ascending order
           },
           {
               $project: {
                   _id: 0, // Exclude the default _id field
                   Date: "$_id", // Rename _id to Date
                   avg_of_IF1: "$avgKWH_IF1", // Rename avgKWH_IF1 to avg_of_IF1
                   avg_of_IF2: "$avgKWH_IF2"  // Rename avgKWH_IF2 to avg_of_IF2
               }
           }
       ]).toArray();

       // Store the aggregated results in the KWHAverage schema
       await KWHAverage.deleteMany({}); // Clear existing data if needed
       try {
           await KWHAverage.insertMany(aggregatedData.map(item => {
            //    console.log('Inserting Item:', item);
               return {
                   Date: item.Date, // Include the Date field
                   avg_of_IF1: item.avg_of_IF1, // Use the average for IF1
                   avg_of_IF2: item.avg_of_IF2  // Use the average for IF2
               };
           }));
           console.log('Data inserted successfully'); // Log success message
       } catch (insertError) {
           console.error('Error inserting data into KWHAverage:', insertError); // Log any insertion errors
       }

       res.json({ aggregatedData });
   } catch (error) {
       console.error('Error calculating average KWH:', error);
       res.status(500).json({ message: 'Internal Server Error' });
   } finally {
       await client.close();
   }
});

router.get('/api/KWHParts', async (req, res) => {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('Testing');
        const collection = database.collection('EnergyMonitoring');

        // Aggregate KWH_part by date and machine ID
        const aggregatedData = await collection.aggregate([
            {
                $match: {
                    "Machine ID": { $nin: ["IF1", "IF2"] } // Exclude IF1 and IF2
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$Date" } } },
                        machineID: "$Machine ID"
                    },
                    totalKWHPart: { $sum: "$KWH_part" }
                }
            },
            {
                $sort: { "_id.machineID": 1 } // Sort by machine ID alphabetically
            },
            {
                $group: {
                    _id: "$_id.date",
                    machineData: { $push: { k: "$_id.machineID", v: "$totalKWHPart" } }
                }
            },
            {
                $project: {
                    _id: 1,
                    machineData: { $arrayToObject: "$machineData" }
                }
            },
            {
                $sort: { "_id": 1 } // Sort by date
            }
        ]).toArray();

        // Store the aggregated results in the KWHParts schema
        await KWHParts.deleteMany({}); // Clear existing data if needed
        await KWHParts.insertMany(aggregatedData.map(item => ({
            date: item._id,
            machineData: item.machineData
        })));

        res.json({ aggregatedData });
    } catch (error) {
        console.error('Error aggregating KWH parts:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        await client.close();
    }
});

router.get('/api/ConsumptionMoltenMetal', async (req, res) => {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('Testing');
        const collection = database.collection('EnergyMonitoring');

        // Aggregate data by date, summing molten metal and consumption
        const aggregatedData = await collection.aggregate([
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$Date" } } }, // Group by date
                    sum_of_moltenmetal: { $sum: "$Molten Metal" }, // Sum of molten metal
                    sum_of_consumtion: { $sum: "$Consumption" } // Sum of consumption
                }
            },
            {
                $project: {
                    _id: 0, // Exclude the default _id field
                    date: "$_id", // Rename _id to date
                    sum_of_moltenmetal: 1, // Include sum_of_moltenmetal
                    sum_of_consumtion: 1 // Include sum_of_consumtion
                }
            },
            {
                $sort: { date: 1 } // Sort by date in ascending order
            }
        ]).toArray();

        await ConsumptionWrtMoltenMetal.deleteMany({}); // Clear existing data if needed
        await ConsumptionWrtMoltenMetal.insertMany(aggregatedData.map(item => {
            return {
                date: item.date,
                sum_of_moltenmetal: item.sum_of_moltenmetal,
                sum_of_consumtion: item.sum_of_consumtion
            };
        }));

        res.json({ aggregatedData });
    } catch (error) {
        console.error('Error aggregating molten metal consumption:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        await client.close();
    }
});

router.get('/api/TimeZone', async (req, res) => {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('Testing');
        const collection = database.collection('EnergyMonitoring');

        const aggregatedData = await collection.aggregate([
            {
                $addFields: {
                    // Convert "Cost of Energy" string to number by removing "₹ " and commas
                    cleanedCost: {
                        $toDouble: {
                            $replaceAll: {
                                input: {
                                    $replaceAll: {
                                        input: "$Cost of Energy",
                                        find: "₹ ",
                                        replacement: ""
                                    }
                                },
                                find: ",",
                                replacement: ""
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$Date" } } },
                    zoneA: { 
                        $sum: { 
                            $cond: [
                                { $eq: ["$MSEB Zone", "Zone A"] }, 
                                "$cleanedCost", 
                                0
                            ] 
                        } 
                    },
                    zoneB: { 
                        $sum: { 
                            $cond: [
                                { $eq: ["$MSEB Zone", "Zone B"] }, 
                                "$cleanedCost", 
                                0
                            ] 
                        } 
                    },
                    zoneC: { 
                        $sum: { 
                            $cond: [
                                { $eq: ["$MSEB Zone", "Zone C"] }, 
                                "$cleanedCost", 
                                0
                            ] 
                        } 
                    },
                    zoneD: { 
                        $sum: { 
                            $cond: [
                                { $eq: ["$MSEB Zone", "Zone D"] }, 
                                "$cleanedCost", 
                                0
                            ] 
                        } 
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: "$_id",
                    zoneA: 1,
                    zoneB: 1,
                    zoneC: 1,
                    zoneD: 1
                }
            },
            {
                $sort: { date: 1 }
            }
        ]).toArray();

        // Store the aggregated results in the TimeZoneCost schema
        await TimeZoneCost.deleteMany({}); // Clear existing data
        await TimeZoneCost.insertMany(aggregatedData.map(item => ({
            date: new Date(item.date),
            zoneA: item.zoneA,
            zoneB: item.zoneB,
            zoneC: item.zoneC,
            zoneD: item.zoneD
        })));

        res.json({ aggregatedData });
    } catch (error) {
        console.error('Error aggregating timezone costs:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        await client.close();
    }
});

router.get('/api/consumption', async (req, res) => {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('test');
        const collection = database.collection('EnergyMonitoring');

        const aggregatedData = await collection.aggregate([
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$Date" } } },
                        department: "$Department",
                        machineId: "$Machine ID",
                        hours: "$Hours"
                    },
                    pf: { $first: "$P#F" },
                    consumption: { $first: "$Consumption" }
                }
            },
            {
                $sort: {
                    "_id.hours": 1
                }
            },
            {
                $group: {
                    _id: {
                        date: "$_id.date",
                        department: "$_id.department",
                        machineId: "$_id.machineId"
                    },
                    hourData: {
                        $push: {
                            k: { $toString: "$_id.hours" },
                            v: {
                                P_F: "$pf",
                                consumption: "$consumption"
                            }
                        }
                    }
                }
            },
            {
                $sort: {
                    "_id.machineId": 1
                }
            },
            {
                $group: {
                    _id: {
                        date: "$_id.date",
                        department: "$_id.department"
                    },
                    machineData: {
                        $push: {
                            k: "$_id.machineId",
                            v: { $arrayToObject: "$hourData" }
                        }
                    }
                }
            },
            {
                $sort: {
                    "_id.department": 1
                }
            },
            {
                $group: {
                    _id: "$_id.date",
                    departments: {
                        $push: {
                            k: "$_id.department",
                            v: { $arrayToObject: "$machineData" }
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    Date: "$_id",
                    Departments: { $arrayToObject: "$departments" }
                }
            },
            {
                $sort: { Date: 1 }
            }
        ]).toArray();

        // Replace the direct MongoDB insertion with Mongoose model
        await DailyPFTrend.deleteMany({});
        await DailyPFTrend.create(aggregatedData);

        res.json({ aggregatedData });
    } catch (error) {
        console.error('Error aggregating consumption data:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        await client.close();
    }
});

router.get('/api/energyMonitoring', async (req, res) => {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('Testing');
        const collection = database.collection('EnergyMonitoring');

        // Retrieve all documents from the EnergyMonitoring collection
        const data = await collection.find({}).toArray();

        res.json({ data });
    } catch (error) {
        console.error('Error retrieving energy monitoring data:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        await client.close();
    }
});

// New endpoint to fetch chat data and respond with concatenated text
router.post('/api/chat-response', async (req, res) => {
    const { prompt } = req.body; // Extract prompt from request body
    const mongoClient = new MongoClient(uri); // Declare mongoClient here
    try {
        console.log('Fetching data from MongoDB...');
        await mongoClient.connect();
        const database = mongoClient.db('test');
        const collection = database.collection('consumptionwrtmoltenmetals');
        const data = await collection.find({}).toArray(); // Fetch data from MongoDB

        console.log('Data fetched from MongoDB:', data); // Log the fetched data

        // Prepare the message for the model, including the entire dataset
        const messages = [
            { role: "system", content: "You are a data generator. Based on the prompt, provide only the JSON data needed for plotting without any descriptions or explanations." },
            { role: "user", content: `${prompt} Here is the data: ${JSON.stringify(data)}` }
        ];

        // Call the OpenAI model
        const response = await client.chat.completions.create({
            messages: messages,
            temperature: 1.0,
            top_p: 1.0,
            max_tokens: 1000,
            model: modelName
        });

        console.log('Received response from GPT-4o mini API.');
        const modelResponse = response.choices[0].message.content; // Get the model's response

        // Clean the model response to remove any unwanted characters
        const cleanedResponse = modelResponse.replace(/```json|```/g, '').trim(); // Remove markdown formatting

        // Parse the cleaned model response as JSON
        let plotData;
        try {
            plotData = JSON.parse(cleanedResponse); // Parse the JSON response from the model
            
            // Check if the response contains relevant data
            if (!plotData || (Array.isArray(plotData) && plotData.length === 0)) {
                return res.json({ message: 'No relevant data' }); // Return message if no relevant data found
            }
        } catch (error) {
            console.error('Error parsing model response:', error);
            return res.status(500).json({ message: 'Error parsing model response' });
        }

        // Send the structured plot data
        res.json({
            plotData: plotData // Send the structured data for the frontend
        });
    } catch (error) {
        console.error('Error querying GPT-4o mini:', error.message);
        res.status(500).json({ message: 'Internal Server Error', error: error.message }); // Send error details
    } finally {
        await mongoClient.close(); // Ensure the MongoDB client is closed
    }
});

export default router;
