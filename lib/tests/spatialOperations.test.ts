import { checkPointInPolygon, getArea, getCentroid, getBuffer, getDistance, getIntersection } from '../controllers/spatialOperations';
import { GeoJSON } from '../types';
import { describe, expect, test } from '@jest/globals';
import sampleData from '../sample-data.json';

describe('Spatial Operations Tests', () => {
  const polygonGeoJSON: GeoJSON = {
    type: 'Polygon',
    coordinates: [
      [
        [77.0038659, 28.378123],
        [77.0038766, 28.3774528],
        [77.0032436, 28.3774528],
        [77.0033295, 28.3762918],
        [77.00584, 28.3762634],
        [77.0056898, 28.3782646],
        [77.0038659, 28.378123],
      ],
    ],
  };

  const pointInsideGeoJSON: GeoJSON = {
    type: 'Point',
    coordinates: [77.003912, 28.377525],
  };

  const pointOutsideGeoJSON: GeoJSON = {
    type: 'Point',
    coordinates: [77.429404, 28.351578],
  };

  test('checkPointInPolygon - point inside', async () => {
    const result = await checkPointInPolygon({ geom1: polygonGeoJSON, geom2: pointInsideGeoJSON });
    expect(result?.is_contained).toBe(true);
  });

  test('checkPointInPolygon - point outside', async () => {
    const result = await checkPointInPolygon({ geom1: polygonGeoJSON, geom2: pointOutsideGeoJSON });
    expect(result?.is_contained).toBe(false);
  });

  const areaPolygonGeoJSON: GeoJSON = {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
    ],
  };

  test('getArea', async () => {
    const result = await getArea({ geom: areaPolygonGeoJSON });
    expect(result).toHaveProperty('area');
    expect(result).toHaveProperty('area_acres');
    expect(result).toHaveProperty('area_hectares');
    expect(result?.area).toBeGreaterThan(0);
  });

  const centroidPolygonGeoJSON: GeoJSON = {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [0, 2],
        [2, 2],
        [2, 0],
        [0, 0],
      ],
    ],
  };

  test('getCentroid', async () => {
    const result = await getCentroid({ geom: centroidPolygonGeoJSON });
    expect(result).toEqual({
      type: 'Point',
      coordinates: [1, 1],
    });
  });

  const bufferPointGeoJSON: GeoJSON = {
    type: 'Point',
    coordinates: [0, 0],
  };

  test('getBuffer', async () => {
    const result = await getBuffer({ geom: bufferPointGeoJSON, distance: 100 });
    expect(result).toHaveProperty('type', 'Polygon');
    expect(result.coordinates[0].length).toBeGreaterThan(3);
  });

  const distancePoint1GeoJSON: GeoJSON = {
    type: 'Point',
    coordinates: [0, 0],
  };

  const distancePoint2GeoJSON: GeoJSON = {
    type: 'Point',
    coordinates: [1, 1],
  };

  test('getDistance', async () => {
    const result = await getDistance({ geom1: distancePoint1GeoJSON, geom2: distancePoint2GeoJSON });
    expect(result).toHaveProperty('distance');
    expect(result).toHaveProperty('units', 'meters');
    expect(result?.distance).toBeGreaterThan(0);
  });

  const intersectingPolygon1GeoJSON: GeoJSON = {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [0, 2],
        [2, 2],
        [2, 0],
        [0, 0],
      ],
    ],
  };

  const intersectingPolygon2GeoJSON: GeoJSON = {
    type: 'Polygon',
    coordinates: [
      [
        [1, 1],
        [1, 3],
        [3, 3],
        [3, 1],
        [1, 1],
      ],
    ],
  };

  test('getIntersection - intersecting polygons', async () => {
    const result = await getIntersection({ geom1: intersectingPolygon1GeoJSON, geom2: intersectingPolygon2GeoJSON });
    expect(result?.intersects).toBe(true);
    expect(result?.intersection).toHaveProperty('type', 'Polygon');
  });

  const nonIntersectingPolygonGeoJSON: GeoJSON = {
    type: 'Polygon',
    coordinates: [
      [
        [3, 3],
        [3, 4],
        [4, 4],
        [4, 3],
        [3, 3],
      ],
    ],
  };

  test('getIntersection - non-intersecting polygons', async () => {
    const result = await getIntersection({ geom1: intersectingPolygon1GeoJSON, geom2: nonIntersectingPolygonGeoJSON });
    expect(result?.intersects).toBe(false);
    expect(result?.intersection).toBeNull();
  });
});
