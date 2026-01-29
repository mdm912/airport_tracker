import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAirportStore } from '../store/useAirportStore';
import L from 'leaflet';
import { Plus, Minus } from 'lucide-react';

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

            if (airport) {
                // Always fly to location, even if marker ref is missing
                map.flyTo([airport.lat, airport.lng], 12, {
                    duration: 1.5
                });

                // Try to open popup if marker exists
                if (marker) {
                    setTimeout(() => {
                        marker.openPopup();
                    }, 500);
                }

                // Clear focus immediately after dispatching actions
                setFocusAirportId(null);
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

const CustomZoomControl: React.FC = () => {
    const map = useMap();
    const [zoom, setZoom] = React.useState(map.getZoom());

    React.useEffect(() => {
        const updateZoom = () => {
            setZoom(map.getZoom());
        };

        map.on('zoomend', updateZoom);
        return () => {
            map.off('zoomend', updateZoom);
        };
    }, [map]);

    const handleZoomIn = (e: React.MouseEvent) => {
        e.stopPropagation();
        map.zoomIn();
    };

    const handleZoomOut = (e: React.MouseEvent) => {
        e.stopPropagation();
        map.zoomOut();
    };

    return (
        <div className="leaflet-top leaflet-left">
            <div className="leaflet-control leaflet-bar flex flex-col items-center bg-white shadow-md rounded-md overflow-hidden border-2 border-rgba(0,0,0,0.2) mt-2.5 ml-2.5">
                <button
                    onClick={handleZoomIn}
                    className="p-2 hover:bg-gray-100 border-b border-gray-200 transition-colors w-full flex justify-center bg-white cursor-pointer"
                    title="Zoom In"
                >
                    <Plus className="h-4 w-4 text-gray-700" />
                </button>
                <div
                    className="px-2 py-1 text-xs font-bold text-gray-900 bg-gray-50 flex justify-center items-center w-full select-none cursor-default"
                    title={`Current Zoom Level: ${zoom}`}
                >
                    {zoom}
                </div>
                <button
                    onClick={handleZoomOut}
                    className="p-2 hover:bg-gray-100 border-t border-gray-200 transition-colors w-full flex justify-center bg-white cursor-pointer"
                    title="Zoom Out"
                >
                    <Minus className="h-4 w-4 text-gray-700" />
                </button>
            </div>
        </div>
    );
};



const VFRTileLayer: React.FC = () => {
    const { mapSettings } = useAirportStore();
    return (
        <TileLayer
            key={`vfr-${mapSettings.detectRetina}-${mapSettings.pixelated}`}
            attribution='FAA VFR Sectional &copy; <a href="https://www.faa.gov">FAA</a>'
            url="https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}"
            minZoom={5}
            minNativeZoom={8}
            maxZoom={22}
            maxNativeZoom={11}
            opacity={1}
            zIndex={100}
            detectRetina={mapSettings.detectRetina}
            className={mapSettings.pixelated ? "pixelated-tiles" : ""}
        />
    );
};

const TACTileLayer: React.FC = () => {
    const { mapSettings } = useAirportStore();
    return (
        <TileLayer
            key={`tac-${mapSettings.detectRetina}-${mapSettings.pixelated}`}
            attribution='FAA Terminal Area Charts &copy; <a href="https://www.faa.gov">FAA</a>'
            url="https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Terminal/MapServer/tile/{z}/{y}/{x}"
            minZoom={10}
            maxZoom={22}
            maxNativeZoom={11}
            opacity={1}
            zIndex={101}
            detectRetina={mapSettings.detectRetina}
            className={mapSettings.pixelated ? "pixelated-tiles" : ""}
        />
    );
};

const MapComponent: React.FC = () => {
    const { airports, removeAirport, mapLayer } = useAirportStore();
    const markerRefs = useRef<Map<string, L.Marker>>(new Map());

    return (
        <div className="h-full w-full relative z-0">
            <MapContainer center={[47.5, -122.2]} zoom={8} minZoom={4} maxZoom={12} scrollWheelZoom={true} className="h-full w-full" zoomControl={false}>
                <FocusHandler markerRefs={markerRefs} />
                <CustomZoomControl />
                {/* Base Layer (OSM fallback) */}
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    detectRetina={true}
                />

                {/* VFR Overlay - custom component handles zoom 10 by using zoom 9 tiles */}
                {mapLayer === 'sectional' && (
                    <>
                        <VFRTileLayer />
                        <TACTileLayer />
                    </>
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
                                    onClick={(e) => {
                                        e.stopPropagation(); // Stop propagation for remove button
                                        removeAirport(airport.id);
                                    }}
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
