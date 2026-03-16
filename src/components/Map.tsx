import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAirportStore } from '../store/useAirportStore';
import L from 'leaflet';
import { Plus, Minus } from 'lucide-react';

import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const makeColoredIcon = (color: string) =>
    L.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41" width="25" height="41">
  <path fill="${color}" stroke="#fff" stroke-width="1.5"
    d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z"/>
  <circle fill="rgba(255,255,255,0.4)" cx="12.5" cy="12.5" r="5"/>
</svg>`,
        className: '',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: iconShadow,
        shadowSize: [41, 41],
    });

const visitedIcon = makeColoredIcon('#f97316');   // orange-500
const wishlistIcon = makeColoredIcon('#14b8a6');  // teal-500

import { TAC_CHARTS } from '../data/tacBounds';

interface ClippedTileLayerProps extends L.TileLayerOptions {
    url: string;
    polygon: L.LatLngExpression[];
}

const ClippedTileLayer: React.FC<ClippedTileLayerProps> = ({ url, polygon, ...options }) => {
    const map = useMap();
    const layerRef = useRef<L.TileLayer>(null);

    useEffect(() => {
        const updateClipPath = () => {
            const layer = layerRef.current;
            if (!layer) return;

            const container = (layer as any)._container as HTMLElement;
            if (!container) return;

            // Important: Leaflet moves the container via CSS Transform (DomUtil.getPosition/setPosition)
            // To clip correctly, we need the points relative to the container itself.
            const containerPos = L.DomUtil.getPosition(container);

            const clipPoints = polygon.map(latlng => {
                const p = map.latLngToLayerPoint(latlng);
                return {
                    x: p.x - containerPos.x,
                    y: p.y - containerPos.y
                };
            });

            const path = `polygon(${clipPoints.map(p => `${Math.round(p.x)}px ${Math.round(p.y)}px`).join(', ')})`;
            (container.style as any).clipPath = path;
            (container.style as any).webkitClipPath = path; // For broader compatibility

        };

        map.on('move zoom viewreset', updateClipPath);

        // Initial sync with retries to ensure Leaflet has created the container
        let retries = 0;
        const interval = setInterval(() => {
            updateClipPath();
            if (retries++ > 10 || (layerRef.current && (layerRef.current as any)._container)) {
                clearInterval(interval);
            }
        }, 100);

        return () => {
            map.off('move zoom viewreset', updateClipPath);
            clearInterval(interval);
        };
    }, [map, polygon]);

    return <TileLayer ref={layerRef} url={url} {...options} />;
};




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

const UrlPositioner: React.FC = () => {
    const map = useMap();
    const { setMapLayer } = useAirportStore();

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const tacParam = urlParams.get('tac');
        const latParam = urlParams.get('lat');
        const lngParam = urlParams.get('lng');
        const zoomParam = urlParams.get('zoom');

        if (tacParam) {
            const tac = TAC_CHARTS.find(t => t.id === tacParam.toUpperCase());
            if (tac && tac.bounds) {
                map.fitBounds(tac.bounds as L.LatLngBoundsExpression);
                setMapLayer('sectional');
            }
        } else if (latParam && lngParam && zoomParam) {
            map.setView([parseFloat(latParam), parseFloat(lngParam)], parseInt(zoomParam, 10));
        }
    }, [map, setMapLayer]);

    return null;
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
        <>
            {TAC_CHARTS.map(tac => (
                <ClippedTileLayer
                    key={`tac-${tac.id}-${mapSettings.detectRetina}-${mapSettings.pixelated}`}
                    attribution='FAA Terminal Area Charts &copy; <a href="https://www.faa.gov">FAA</a>'
                    url="https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Terminal/MapServer/tile/{z}/{y}/{x}"
                    minZoom={10}
                    maxZoom={22}
                    maxNativeZoom={11}
                    opacity={1}
                    zIndex={101}
                    detectRetina={mapSettings.detectRetina}
                    className={mapSettings.pixelated ? "pixelated-tiles" : ""}
                    bounds={tac.bounds}
                    polygon={tac.polygon}
                />
            ))}
        </>
    );
};


const MapComponent: React.FC = () => {
    const { airports, removeAirport, mapLayer } = useAirportStore();
    const markerRefs = useRef<Map<string, L.Marker>>(new Map());

    return (
        <div className="h-full w-full relative z-0">
            <MapContainer center={[47.5, -122.2]} zoom={8} minZoom={4} maxZoom={12} scrollWheelZoom={true} className="h-full w-full" zoomControl={false}>
                <FocusHandler markerRefs={markerRefs} />
                <UrlPositioner />
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
                        icon={airport.type === 'visited' ? visitedIcon : wishlistIcon}
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
                                    <span className={`h-2 w-2 rounded-full ${airport.type === 'visited' ? 'bg-orange-500' : 'bg-teal-500'}`}></span>
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
