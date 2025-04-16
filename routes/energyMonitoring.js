import express from 'express';
import { MongoClient} from 'mongodb'; // Import ObjectId for querying by ID
import dotenv from 'dotenv';
import DepartmentCost from '../models/DepartmentCost.js';
import KWHAverage from '../models/KWHAverage.js'; // Import the new KWHAverage model
import KWHParts from '../models/KWHParts.js'; // Import the KWHParts model
import ConsumptionWrtMoltenMetal from '../models/ConsumptionWrtMoltenMetel.js'; // Import the new ConsumptionWrtMoltenMetal model
import TimeZoneCost from '../models/TimeZoneCost.js'; // Add this with other imports
import DailyPFTrend from '../models/DailyPFTrend.js'; // Import DailyPFTrend model
import { GoogleGenAI } from "@google/genai"; // Import the GoogleGenAI package

dotenv.config();

const router = express.Router();
const uri = process.env.MONGODB_URI; // Use your MongoDB URI from .env

const gemini_api_key = process.env.GEMINI_API_KEY; // Use the Gemini API key
const ai = new GoogleGenAI({ apiKey: gemini_api_key }); // Initialize with your API key

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
        const database = client.db('Testing');
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

router.post('/api/chat-response', async (req, res) => {
    const { prompt } = req.body;
    const mongoClient = new MongoClient(uri);
    try {
        await mongoClient.connect();
        const database = mongoClient.db('Testing');
        const collection = database.collection('consumptionwrtmoltenmetals');
        
        const data = await collection.find({}).toArray();


        const modelPrompt = `
            Based on the following energy monitoring data, analyze and create a visualization or card display for this query: "${prompt}"
            
            Data Context:
            - Consumption and moltenmetal usage
            
            Raw Data: ${JSON.stringify(data)}
            
            Instructions:
            1. RELEVANCE CHECK:
               First, determine if the query is relevant to given data
            
            2. FOR NON-RELEVANT QUERIES:
               Return this exact format:
               {
                 "displayType": "cards",
                 "cards": [{
                   "title": "Not Relevant Query",
                   "value": "N/A",
                   "unit": "",
                   "description": "This query is not related to energy monitoring data. Try asking about:\n• Energy consumption patterns\n• Power factor analysis\n• Production costs\n• Department efficiency\n• Machine performance\n• Time-based trends",
                   "trend": "neutral"
                 }]
               } 
            
            3. FOR RELEVANT DATA WITH TRENDS/PATTERNS:
               Return in this format:
               {
                 "displayType": "chart",
                 "chartConfig": {
                   "chartType": "line" | "bar" | "pie" | "scatter",
                   "title": "Clear, descriptive title",
                   "labels": ["x-axis labels"],
                   "datasets": [{
                     "label": "Meaningful series name",
                     "data": [numerical values only],
                     "backgroundColor": "appropriate color",
                     "borderColor": "appropriate color",
                     "borderWidth": number
                   }],
                   "options": {
                     "scales": {
                       "y": {
                         "beginAtZero": boolean,
                         "title": {"text": "axis label"}
                       }
                     }
                   }
                 }
               }
            
            4. FOR SINGLE METRICS OR INSIGHTS:
               Return in this format:
               {
                 "displayType": "cards",
                 "cards": [{
                   "title": "Clear metric name",
                   "value": "precise value",
                   "unit": "appropriate unit",
                   "description": "Concise, informative context",
                   "trend": "up" | "down" | "neutral"
                 }]
               }
            
            IMPORTANT RULES:
            • Return ONLY valid JSON
            • Use ONLY data provided in the Raw Data
            • Ensure numerical values are properly formatted
            • Include units where applicable
            • Keep descriptions concise and informative
            • Use appropriate chart types for data visualization
            • Maintain consistent decimal places for numerical values
            • Include trend indicators only when there's clear directional change
            
            Return ONLY a valid JSON object matching one of the above formats.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: modelPrompt
        });

        if (!response || !response.text) {
            return res.json({ message: 'No relevant data' });
        }

        try {
            // Clean up the response text and log it for debugging
            let jsonText = response.text
                .replace(/```json\n?|\n?```/g, '')
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
                .trim();
            
            console.log('Cleaned JSON text:', jsonText); // Add this line for debugging

            // Try to parse the JSON
            let displayConfig;
            try {
                displayConfig = JSON.parse(jsonText);
            } catch (parseError) {
                console.error('JSON Parse Error. Raw text:', jsonText);
                throw new Error(`Invalid JSON format: ${parseError.message}`);
            }

            // Validate the configuration based on display type
            if (!displayConfig.displayType || !['chart', 'cards'].includes(displayConfig.displayType)) {
                throw new Error('Invalid display configuration');
            }

            if (displayConfig.displayType === 'chart' && 
                (!displayConfig.chartConfig || !displayConfig.chartConfig.chartType || 
                 !displayConfig.chartConfig.datasets || !displayConfig.chartConfig.labels)) {
                throw new Error('Invalid chart configuration');
            }

            if (displayConfig.displayType === 'cards' && 
                (!Array.isArray(displayConfig.cards) || displayConfig.cards.length === 0 ||
                 !displayConfig.cards.every(card => card.title && card.value))) {
                throw new Error('Invalid cards configuration');
            }

            // Send the display configuration and original data
            res.json({
                displayConfig,
            });
        } catch (parseError) {
            console.error('Error parsing response:', parseError);
            res.status(500).json({ 
                message: 'Error parsing AI response', 
                error: parseError.message,
                rawResponse: response.text.substring(0, 1000)
            });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            message: 'Internal Server Error', 
            error: error.message 
        });
    } finally {
        await mongoClient.close();
    }
});

export default router;
