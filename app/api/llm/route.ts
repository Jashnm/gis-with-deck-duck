import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { initializeDB } from '@/lib/db';

interface InputPoint {
  'st_asgeojson(geom)': string;
}

interface GeoJSONPoint {
  type: 'Point';
  coordinates: number[];
}

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
- Input coodinates will be in EPSG:4326 projection so use the methods accordingly.
- To make a point, use ST_Point method with coordinates of the point - latitude in first position and longitude in 2nd position.
- To make a polygon, use ST_Polygon method.
- Use world_points table as the table for queries.
- convert KM to metres when distance or radius is mentioned.
- Use Spherical methods wherever available(for eg.: ST_Distance_Sphere instead of ST_Distance) for easy support with EPSG:4326 projection.
- When asked to create buffer, use the results from before and use ST_Transform(syntax: ST_Transform(geom BOX_2D, source_crs VARCHAR, target_crs VARCHAR)) first to convert the point/s to appropriate utm zone CRS before calculating buffer and 
then transform the result back to EPSG:4326(use this full name as string while doing transform and "explicitly" mention source CRS and target CRS both the times) and return in geojson format.
- The sql query shall not return all the columns of the table but only geom or the one which has geometries in geojson format(use ST_AsGeoJSON).

Return the response in a json format(without code block syntax) with operation name as a property and query as the another one which will have SQl query as plain text without code block syntax around it.`;

export async function POST(req: Request) {
  const { query, selectedPoint, context } = await req.json();

  let currentCtx: any = [];
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    let messages: any[] = [{ role: 'user', content: SYSTEM_PROMPT }];

    const currentMsg = { role: 'user', content: `${query} ${selectedPoint ? `for latidude: ${selectedPoint.latitude} and longitude: ${selectedPoint.longitude}` : ''}` };

    if (context) {
      messages = messages.concat(context);
    }

    messages.push(currentMsg);
    const response = await openai.chat.completions.create({
      model: 'o1-mini',
      messages: messages,
    });
    console.log('🚀 ~ POST ~ response:', response);

    //@ts-ignore
    const parsedOperation = response.choices[0].message.content;
    console.log('🚀 ~ handler ~ parsedOperation:', parsedOperation);

    currentCtx = messages.slice(1).concat({ role: 'assistant', content: parsedOperation });
    if (parsedOperation) {
      const parsedGeoOperation: any = JSON.parse(parsedOperation);
      console.log('🚀 ~ POST ~ parsedGeoOperation:', parsedGeoOperation);
      const db = await initializeDB();
      const result = await db?.all(parsedGeoOperation.query);
      console.log('🚀 ~ POST ~ result:', result);

      const geometry = transformToMultiPoint(result);
      console.log('🚀 ~ POST ~ geometry:', geometry);
      return NextResponse.json({ operation: parsedGeoOperation.operation, geometry, currentCtx: currentCtx });
    }
  } catch (error) {
    console.log('🚀 ~ POST ~ error:', error);
    return NextResponse.json({ error: 'Error processing LLM request', currentCtx: currentCtx });
  }
}
