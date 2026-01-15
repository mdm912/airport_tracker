export type AirportType = 'visited' | 'wishlist' | 'fuel';

export interface Airport {
    id: string;
    code: string; // ICAO or IATA
    name?: string;
    lat: number;
    lng: number;
    type: AirportType;
    notes?: string;
    dateVisited?: string; // ISO date string
    source?: 'from' | 'to' | 'route';
}

export interface FlightLogEntry {
    date: string;
    from: string;
    to: string;
    route?: string;
}
