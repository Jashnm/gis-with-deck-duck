import { OpenAI } from 'openai'; // Updated import for Assistants API
import { NextResponse } from 'next/server';
import { initializeDB } from '@/lib/db';

interface MultiPointFeature {
  type: 'Feature';
  geometry: {
    type: 'MultiPoint';
    coordinates: number[][];
  };
  properties: {};
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: {
      type: 'Polygon';
      coordinates: number[][][];
    };
    properties: {};
  }[];
}

function transformToMultiPoint(input: any): MultiPointFeature | FeatureCollection {
  let type: any = null;
  const coordinates = input.map((point: any) => {
    const key = Object.keys(point)[0];

    const geoJson = JSON.parse(point[key]);
    if (!type) type = geoJson.type;
    if (geoJson.type === 'Point') {
      // Swap latitude and longitude
      const [lat, lng] = geoJson.coordinates;
      return [lng, lat];
    } else {
      const coordinates = geoJson.coordinates[0].map((c: any) => {
        console.log(c);
        return [c[1], c[0]];
      });
      return {
        type: 'Feature',
        geometry: {
          type: type,
          coordinates: [coordinates],
        },
        properties: {},
      };
    }
  });

  if (type === 'Point') {
    return {
      type: 'Feature',
      geometry: {
        type: 'MultiPoint',
        coordinates: coordinates,
      },
      properties: {},
    };
  } else {
    return {
      type: 'FeatureCollection',
      features: coordinates,
    };
  }
}

const SYSTEM_PROMPT = `You are a geospatial operation parser. Convert natural language requests into structured spatial operations to be used in duckDB.
- Input coordinates will be in EPSG:4326 projection so use the methods accordingly.
- To make a point, use ST_Point method with coordinates of the point - latitude in first position and longitude in 2nd position.
- To make a polygon, use ST_Polygon method.
- Use world_points table as the table for queries.
- Convert KM to metres when distance or radius is mentioned.
- Use Spherical methods wherever available (e.g., ST_Distance_Sphere instead of ST_Distance) for easy support with EPSG:4326 projection.
- When asked to create buffer, use the results from before and use ST_Transform(syntax: ST_Transform(geom BOX_2D, source_crs VARCHAR, target_crs VARCHAR)) first to convert the point/s to appropriate UTM zone CRS before calculating buffer and then transform the result back to EPSG:4326 (use this full name as string while doing transform and "explicitly" mention source CRS and target CRS both the times) and return in GeoJSON format.
- The SQL query shall not return all the columns of the table but only geom or the one which has geometries in GeoJSON format (use ST_AsGeoJSON).

Return the response in a JSON format (without code block syntax) with operation name as a property and query as another one which will have the SQL query as plain text without code block syntax around it.`;

let threads = [
  {
    id: 'thread_0EpvkurlvB24rOSSyD8GcJTD',
    object: 'thread',
    created_at: 1732097628,
    metadata: { _id: 'new-chat--id' },
    tool_resources: {},
  },
];

export async function POST(req: Request) {
  const { query, selectedPoint, context } = await req.json();

  let currentCtx: any = [];
  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    //Initialize with null, take from the local/db-saved threads array based on chat id provided by frontend
    let threadId = 'thread_0EpvkurlvB24rOSSyD8GcJTD';

    if (!threadId) {
      const thread = await client.beta.threads.create({
        metadata: {
          _id: 'new-chat--id', // Ideally should come from frontend
        },
      });
      console.log(thread);
      threadId = thread.id;
    }

    let messages: any[] = [{ role: 'system', content: SYSTEM_PROMPT }];

    const currentMsg: { role: 'user'; content: string } = {
      role: 'user',
      content: `${query} ${selectedPoint ? `for latitude: ${selectedPoint.latitude} and longitude: ${selectedPoint.longitude}` : ''}`,
    };

    const message = await client.beta.threads.messages.create(threadId, {
      ...currentMsg,
    });

    if (context) {
      messages = messages.concat(context);
    }

    let assistantId: string | undefined;

    const assistants = await client.beta.assistants.list({
      order: 'desc',
      limit: 10,
    });

    //@ts-ignore
    assistantId = assistants.data.find((a) => a.metadata?._id && a.metadata?._id === 'new-chat-id1')?.id;

    messages.push(currentMsg);
    if (!assistantId) {
      const assistant = await client.beta.assistants.create({
        name: 'geospatial-operation-parser',
        model: 'gpt-4o-mini',
        instructions: SYSTEM_PROMPT,
        metadata: {
          _id: 'new-chat-id1',
        },
        tools: [{ type: 'code_interpreter' }],
      });
      assistantId = assistant.id;
    }

    let result = '';
    // currentCtx = messages.slice(1).concat({ role: 'assistant', content: parsedOperation });
    const run = new Promise<string>((resolve) => {
      client.beta.threads.runs
        .stream(threadId, {
          assistant_id: assistantId,
        })
        .on('textCreated', (text) => process.stdout.write('\nassistant > '))
        .on('textDelta', (textDelta, snapshot) => {
          process.stdout.write(textDelta.value || '');
          const str = textDelta.value || '';
          if (str) {
            result += textDelta.value;
          }
        })
        .on('textDone', () => {
          console.log(result, 'RESSS');
          resolve(result);
        })
        .on('toolCallCreated', (toolCall) => process.stdout.write(`\nassistant > ${toolCall.type}\n\n`))
        .on('toolCallDelta', (toolCallDelta, snapshot) => {
          if (toolCallDelta.type === 'code_interpreter') {
            if (toolCallDelta.code_interpreter?.input) {
              console.log('input >\n');
              process.stdout.write(toolCallDelta.code_interpreter.input);
            }
            if (toolCallDelta.code_interpreter?.outputs) {
              process.stdout.write('\noutput >\n');
              toolCallDelta.code_interpreter.outputs.forEach((output) => {
                if (output.type === 'logs') {
                  console.log('OUTPUT >\n');
                  process.stdout.write(`\n${output.logs}\n`);
                }
              });
            }
          }
        });
    });

    const response = await run;
    if (response) {
      console.log('responsetype', typeof response);
      //   console.log('🚀 ~ POST ~ parsedGeoOperation:', parsedGeoOperation);
      const db = await initializeDB();
      const parsedGeoOperation: any = JSON.parse(response);
      currentCtx = messages.slice(1).concat({ role: 'assistant', content: JSON.stringify(parsedGeoOperation) });

      const result = await db?.all(parsedGeoOperation?.query);
      console.log('🚀 ~ POST ~ result:', result);
      const geometry = transformToMultiPoint(result);
      console.log('🚀 ~ POST ~ geometry:', geometry);
      return NextResponse.json({ operation: parsedGeoOperation, geometry, currentCtx: currentCtx });
    }

    return NextResponse.json({ operation: 'No operation performed', currentCtx: currentCtx });
  } catch (error) {
    console.log('🚀 ~ POST ~ error:', error);
    return NextResponse.json({ error: 'Error processing LLM request', currentCtx: currentCtx });
  }
}
