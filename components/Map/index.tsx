'use client';
import React, { useState, useCallback, useEffect, FormEvent } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl';
import { ScatterplotLayer, GeoJsonLayer } from '@deck.gl/layers';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Send, Layers, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';

// Initial view state centered on New York City
const INITIAL_VIEW_STATE = {
  longitude: -73.935242,
  latitude: 40.73061,
  zoom: 12,
  pitch: 0,
  bearing: 0,
};

const GeospatialDashboard = () => {
  // State management
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [points, setPoints] = useState<any[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<any>(null);
  const [bufferResults, setBufferResults] = useState<any>(null);
  console.log('🚀 ~ GeospatialDashboard ~ bufferResults:', bufferResults);
  const [query, setQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [llmHistory, setLlmHistory] = useState<any[]>([]);
  const [layers, setLayers] = useState({
    points: true,
    buffer: true,
  });

  // Layer definitions
  const pointLayer = new ScatterplotLayer({
    id: 'points',
    data: points,
    visible: layers.points,
    getPosition: (d) => [d.longitude, d.latitude],
    getFillColor: (d) => (d.selected ? [255, 0, 0, 255] : [0, 128, 255, 255]),
    getRadius: 100,
    pickable: true,
    onClick: (info) => {
      if (info.object) {
        setSelectedPoint(info.object);
        handlePointSelection(info.object);
      }
    },
  });

  const handlePointSelection = useCallback((selectedPoint: any) => {
    // Update the selected state of all points
    setPoints((prevPoints) =>
      prevPoints.map((point) => ({
        ...point,
        selected: point.id === selectedPoint.id,
      })),
    );

    console.log(selectedPoint, 'point selected', points);

    // Perform any additional actions with the selected point
    // For example, you might want to fetch additional data or update the UI
    setSelectedPoint(selectedPoint);

    // If you want to perform a buffer operation on selection, you could do:
    handleBufferOperation(selectedPoint);
  }, []);

  function swapCoordinates(polygon: { type: string; coordinates: number[][][] }) {
    if (polygon.type !== 'Polygon' || !Array.isArray(polygon.coordinates)) {
      throw new Error('Invalid input: Expected a Polygon object with coordinates');
    }

    const swappedCoordinates = polygon.coordinates.map((ring) => ring.map(([lat, lon]) => [lon, lat]));

    return {
      ...polygon,
      coordinates: swappedCoordinates,
    };
  }
  // Helper function to perform buffer operation
  const handleBufferOperation = async (point: any) => {
    try {
      const response = await fetch('/api/operations/buffer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geom: {
            type: 'Point',
            coordinates: [point.latitude, point.longitude],
          },
          distance: 5000,
        }),
      });

      const data = await response.json();
      console.log('🚀 ~ handleBufferOperation ~ data:', data);
      if (data) {
        const result = swapCoordinates(data);
        console.log('🚀 ~ handleBufferOperation ~ result:', result);
        setBufferResults(result);
      }
    } catch (error) {
      console.error('Error performing buffer operation:', error);
    }
  };

  const bufferLayer = new GeoJsonLayer({
    id: 'buffer',
    data: bufferResults,
    visible: layers.buffer,
    filled: true,
    getFillColor: [0, 255, 0, 50],
    getLineColor: [0, 255, 0, 200],
    getLineWidth: 2,
  });
  // console.log('🚀 ~ GeospatialDashboard ~ bufferLayer:', bufferLayer);

  // Handle map click to add points
  const onMapClick = useCallback(
    (event: any) => {
      if (!event.object) {
        // Only add point if we didn't click an existing point
        const newPoint = {
          longitude: event.coordinate[0],
          latitude: event.coordinate[1],
          id: points.length,
        };
        setPoints((prev) => [...prev, newPoint]);
      }
    },
    [points],
  );

  // Process natural language query
  const handleQuerySubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          selectedPoint,
          context: llmHistory,
        }),
      });

      const data = await response.json();
      console.log('🚀 ~ handleQuerySubmit ~ data:', data);

      // Add to chat history
      setChatHistory((prev) => [
        ...prev,
        {
          type: 'user',
          content: query,
        },
        {
          type: 'assistant',
          content: data.currentCtx[data.currentCtx.length - 1]?.content,
          result: data.geometry,
        },
      ]);

      setLlmHistory(data.currentCtx);

      // Update visualization based on operation type

      console.log('🚀 ~ handleQuerySubmit ~ data.result:', data);
      handleOperationResult(data);
    } catch (error) {
      console.error('Error processing query:', error);
      //@ts-ignore
      console.error('Error processing query:', error.response);
      //@ts-ignore
      console.error('Error processing query:', error.data);
      setChatHistory((prev) => [
        ...prev,
        {
          type: 'error',
          content: 'Error processing your request',
        },
      ]);
    }

    // setLlmHistory(data.currentCtx);

    setQuery('');
  };

  // Handle operation results
  const handleOperationResult = (result: any) => {
    console.log('🚀 ~ handleOperationResult ~ result:', result);
    if (result.geometry && result.geometry.geometry?.type === 'MultiPoint') {
      console.log('🚀 ~ handleOperationResult ~ esult.operati:', result.operation);

      const points = result.geometry.geometry?.coordinates.map((coord: number[], idx: number) => ({ id: idx, longitude: coord[0], latitude: coord[1] }));
      setPoints(points);
      setSelectedPoint(null);
    }
    if (result.geometry && result.geometry?.type === 'FeatureCollection') {
      console.log('🚀 ~ handleOperationResult ~ result.geometry.geometry?.type:', result.geometry.geometry?.type);
      setBufferResults(result.geometry);
    }
  };

  // Utility function to highlight points
  const highlightPoints = (pointIds: any) => {
    setPoints((prev) =>
      prev.map((p) => ({
        ...p,
        selected: pointIds.includes(p.id),
      })),
    );
  };

  return (
    <div className="w-full h-screen relative">
      {/* Main Map */}
      <DeckGL style={{ borderRadius: '20px' }} initialViewState={viewState} controller={true} layers={[pointLayer, bufferLayer]} onClick={onMapClick}>
        <Map mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} mapStyle="mapbox://styles/mapbox/light-v10" />
      </DeckGL>

      {/* Layer Control Panel */}
      <Card className="absolute top-4 left-4 w-64">
        <CardHeader className="p-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <h3 className="font-medium">Layers</h3>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-2">
            {Object.entries(layers).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={() =>
                    setLayers((prev: any) => ({
                      ...prev,
                      [key]: !prev[key],
                    }))
                  }
                />
                <label className="capitalize">{key}</label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chat Interface */}
      <Card className="absolute bottom-4 right-4 w-96 h-96">
        <CardHeader className="p-4 border-b">
          <h3 className="font-medium">Geospatial Assistant</h3>
        </CardHeader>
        <CardContent className="p-4">
          <div className="h-64 overflow-y-auto mb-4 space-y-2">
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`p-2 rounded ${msg.type === 'user' ? 'bg-blue-100 ml-8' : msg.type === 'error' ? 'bg-red-100' : 'bg-gray-100 mr-8'}`}>
                {msg.content}
              </div>
            ))}
          </div>

          <form onSubmit={handleQuerySubmit} className="flex gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Enter your query..." className="flex-1" />
            <Button type="submit">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Selected Point Info */}
      {selectedPoint && (
        <Card className="absolute top-4 right-4 w-64">
          <CardHeader className="p-4">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <h3 className="font-medium">Selected Point</h3>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              <p>Latitude: {selectedPoint.latitude.toFixed(6)}</p>
              <p>Longitude: {selectedPoint.longitude.toFixed(6)}</p>
              <Button onClick={() => setSelectedPoint(null)} variant="outline" className="w-full">
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GeospatialDashboard;
