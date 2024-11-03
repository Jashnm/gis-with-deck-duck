import { checkPointInPolygon, getArea, getBuffer, getCentroid, getDistance, getIntersection } from '@/lib/controllers/spatialOperations';
import { NextResponse } from 'next/server';

export async function POST(request: Request, { params }: { params: Promise<{ operation: string }> }) {
  try {
    const body = await request.json();

    const operation = (await params).operation;
    let response = null;
    if (operation === 'area') {
      response = await getArea({ geom: body.geom });
    }
    if (operation === 'point-in-polygon') {
      response = await checkPointInPolygon({ geom1: body.geom1, geom2: body.geom2 });
    }
    if (operation === 'centroid') {
      response = await getCentroid({ geom: body.geom });
    }
    if (operation === 'buffer') {
      response = await getBuffer({ geom: body.geom, distance: body.distance });
    }
    if (operation === 'distance') {
      response = await getDistance({ geom1: body.geom1, geom2: body.geom2 });
    }
    if (operation === 'intersection') {
      response = await getIntersection({ geom1: body.geom1, geom2: body.geom2 });
    }
    console.log('🚀 ~ POST ~ response:', response);

    return NextResponse.json(response);
  } catch (error) {
    console.log(`Server error in POST /api/operations: ${error}`);
    return NextResponse.error();
  }
}
