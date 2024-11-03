import { initializeDB } from '../db';
import type { GeoJSON } from '../types';

export const checkPointInPolygon = async ({ geom1, geom2 }: { geom1: GeoJSON; geom2: GeoJSON }) => {
  try {
    const db = await initializeDB();
    console.log('🚀 ~ checkPointInPolygon ~ db:', db);
    const geom1String = JSON.stringify(geom1);
    console.log('🚀 ~ checkPointInPolygon ~ geom1String:', geom1String);
    const geom2String = JSON.stringify(geom2);
    console.log('🚀 ~ checkPointInPolygon ~ geom2String:', geom2String);

    if (db) {
      const query = await db.all(`SELECT CASE
      WHEN ST_GeometryType(container) != 'POLYGON' THEN
        false
      ELSE
        ST_Contains(
          container,
          target
        )
      END as is_contained
    FROM (
      SELECT
        ST_GeomFromGeoJSON('${geom1String}') as container,
        ST_GeomFromGeoJSON('${geom2String}') as target
    );`);

      return query[0];
    }
  } catch (error) {
    console.log(' Server error in checkPointInPolygon', error);
    return null;
  }
};

export const getArea = async ({ geom }: { geom: GeoJSON }) => {
  try {
    const db = await initializeDB();
    const geomString = JSON.stringify(geom);

    if (db) {
      const query = await db.all(`
        WITH area_calc AS (SELECT ST_Area_Spheroid(ST_GeomFromGeoJSON('${geomString}')) as area)
        SELECT area,
        area / 4046.86 AS area_acres,
        area / 10000 AS area_hectares
        from area_calc;
        `);

      return query[0];
    }
  } catch (error) {
    console.log('��� ~ getArea ~ error:', error);
    return null;
  }
};

export const getCentroid = async ({ geom }: { geom: GeoJSON }) => {
  try {
    const db = await initializeDB();
    const geomString = JSON.stringify(geom);

    if (db) {
      const query = await db.all(`
        WITH centroid_calc AS (
          SELECT ST_Centroid(ST_GeomFromGeoJSON('${geomString}')) AS centroid
          )
          SELECT 
          ST_X(centroid) AS longitude,
          ST_Y(centroid) AS latitude
          FROM centroid_calc;
          `);

      return {
        type: 'Point',
        coordinates: [query[0].longitude, query[0].latitude],
      };
    }
  } catch (error) {
    console.log(' Server error in getCentroid', error);
    return null;
  }
};

export const getBuffer = async ({ geom, distance }: { geom: GeoJSON; distance: number }) => {
  try {
    const db = await initializeDB();
    const geomString = JSON.stringify(geom);

    if (db) {
      const query = await db.all(
        `
        WITH calc_geom AS (
          SELECT ST_GeomFromGeoJSON('${geomString}') AS geom
          ),
          utm_zone AS (
            SELECT 
            geom, 
            32600 + FLOOR((ST_X(geom) + 180) / 6) AS utm_epsg 
            FROM calc_geom
            ),
            buffer_calc AS (
              SELECT 
              ST_Buffer(ST_Transform(geom, 'EPSG:4326', 'EPSG:' || utm_epsg), ${distance}) AS buffer_geom, 
              utm_epsg
              FROM utm_zone
              )
              SELECT 
              ST_AsGeoJSON(ST_Transform(buffer_geom, 'EPSG:' || utm_epsg, 'EPSG:4326')) AS buffered_geojson
              FROM buffer_calc;`,
      );

      console.log(query[0], 'wwwwww');
      return JSON.parse(query[0].buffered_geojson);
    }
  } catch (error) {
    console.log('Server error in getBuffer', error);
    return null;
  }
};

export const getDistance = async ({ geom1, geom2 }: { geom1: GeoJSON; geom2: GeoJSON }) => {
  try {
    const db = await initializeDB();
    const geom1String = JSON.stringify(geom1);
    const geom2String = JSON.stringify(geom2);

    if (db) {
      const query = await db.all(`
        WITH distance_calc AS (
          SELECT ST_Distance_Spheroid(
            ST_GeomFromGeoJSON('${geom1String}'),
            ST_GeomFromGeoJSON('${geom2String}')
            ) AS distance
            )
            SELECT ROUND(distance, 2) AS distance
            FROM distance_calc;
            `);

      return {
        distance: query[0].distance,
        units: 'meters',
      };
    }
  } catch (error) {
    console.log('Server error in getDistance', error);
    return null;
  }
};

export const getIntersection = async ({ geom1, geom2 }: { geom1: GeoJSON; geom2: GeoJSON }) => {
  try {
    const db = await initializeDB();
    const geom1String = JSON.stringify(geom1);
    const geom2String = JSON.stringify(geom2);

    if (db) {
      const query = await db.all(`
        WITH intersection_calc AS (
          SELECT 
          ST_Intersects(
            ST_GeomFromGeoJSON('${geom1String}'),
            ST_GeomFromGeoJSON('${geom2String}')
            ) AS intersects,
            ST_Intersection(
              ST_GeomFromGeoJSON('${geom1String}'),
              ST_GeomFromGeoJSON('${geom2String}')
              ) AS intersection_geom
              )
              SELECT 
              intersects,
              CASE 
              WHEN intersects THEN ST_AsGeoJSON(intersection_geom)
              ELSE NULL
              END AS intersection
              FROM intersection_calc;
              `);

      const result = query[0];
      return {
        intersects: result.intersects,
        intersection: result.intersection ? JSON.parse(result.intersection) : null,
      };
    }
  } catch (error) {
    console.log('Server error in getIntersection', error);
    return null;
  }
};
