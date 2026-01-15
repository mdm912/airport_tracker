import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAirportStore } from '../store/useAirportStore';
import L from 'leaflet';

// Fix for default marker icon in Leaflet with Webpack/Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const FocusHandler: React.FC<{ markerRefs: React.MutableRefObject<Map<string, L.Marker>> }> = ({ markerRefs }) => {
    const map = useMap();
    const { focusAirportId, airports, setFocusAirportId, focusBounds, setFocusBounds } = useAirportStore();

    useEffect(() => {
        if (focusAirportId) {
            const airport = airports.find(a => a.id === focusAirportId);
            const marker = markerRefs.current.get(focusAirportId);

            if (airport && marker) {
                map.flyTo([airport.lat, airport.lng], 12, {
                    duration: 1.5
                });

                // Small delay to ensure flyTo has started/finished or marker is ready
                setTimeout(() => {
                    marker.openPopup();
                    setFocusAirportId(null);
                }, 500);
            }
        }
    }, [focusAirportId, airports, map, markerRefs, setFocusAirportId]);

    useEffect(() => {
        if (focusBounds && focusBounds.length > 0) {
            map.fitBounds(focusBounds, {
                padding: [50, 50],
                maxZoom: 12,
                animate: true,
                duration: 1.5
            });
            // Clear bounds after handled
            setFocusBounds(null);
        }
    }, [focusBounds, map, setFocusBounds]);

    return null;
};

const MapComponent: React.FC = () => {
    const { airports, removeAirport, mapLayer } = useAirportStore();
    const markerRefs = useRef<Map<string, L.Marker>>(new Map());

    return (
        <div className="h-full w-full relative z-0">
            <MapContainer center={[47.5, -122.2]} zoom={10} scrollWheelZoom={true} className="h-full w-full">
                <FocusHandler markerRefs={markerRefs} />
                {/* Base Layer (Always visible) */}
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* VFR Overlay */}
                {mapLayer === 'sectional' && (
                    <TileLayer
                        attribution='FAA VFR Sectional &copy; <a href="https://www.faa.gov">FAA</a>'
                        url="https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}"
                        minZoom={0}
                        maxZoom={20}
                        maxNativeZoom={10}
                        opacity={1}
                        zIndex={100}
                    />
                )}
                {airports.map((airport) => (
                    <Marker
                        key={airport.id}
                        position={[airport.lat, airport.lng]}
                        ref={(ref) => {
                            if (ref) {
                                markerRefs.current.set(airport.id, ref);
                            } else {
                                markerRefs.current.delete(airport.id);
                            }
                        }}
                    >
                        <Popup>
                            <div className="min-w-[120px]">
                                <div className="font-bold flex justify-between items-center mb-1">
                                    <span>{airport.code}</span>
                                    <span className={`h-2 w-2 rounded-full ${airport.type === 'visited' ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                                </div>
                                <div className="text-sm mb-2">{airport.name}</div>
                                <div className="text-[10px] uppercase font-bold text-gray-500 mb-2">{airport.type}</div>
                                <button
                                    onClick={() => removeAirport(airport.id)}
                                    className="w-full py-1 px-2 bg-red-50 text-red-600 text-xs rounded hover:bg-red-500 hover:text-white transition-colors border border-red-100"
                                >
                                    Remove Airport
                                </button>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
};

export default MapComponent;
