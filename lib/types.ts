type Coordinates = number[];
type PolygonCoordinates = number[][][];
type LineStringCoordinates = number[][];

export interface GeoJSON {
  type: 'Point' | 'LineString' | 'Polygon';
  coordinates: Coordinates | LineStringCoordinates | PolygonCoordinates;
}
