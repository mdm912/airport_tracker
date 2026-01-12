import type { Airport } from '../types';

// A small static database of airports found in the user's log to make the demo work immediately.
// In a full version, this would be replaced by a massive JSON file or an API.

export const AIRPORT_DATABASE: Record<string, Omit<Airport, 'id' | 'type' | 'notes' | 'dateVisited'>> = {
    'KRNT': { code: 'KRNT', name: 'Renton Municipal', lat: 47.4931, lng: -122.2158 },
    'RNT': { code: 'KRNT', name: 'Renton Municipal', lat: 47.4931, lng: -122.2158 },
    'S50': { code: 'S50', name: 'Auburn Municipal', lat: 47.3283, lng: -122.2263 },
    'KPAE': { code: 'KPAE', name: 'Paine Field', lat: 47.9063, lng: -122.2821 },
    'PAE': { code: 'KPAE', name: 'Paine Field', lat: 47.9063, lng: -122.2821 },
    'KPLU': { code: 'KPLU', name: 'Thun Field', lat: 47.1081, lng: -122.2878 },
    'KPWT': { code: 'KPWT', name: 'Bremerton National', lat: 47.4880, lng: -122.7630 },
    'PWT': { code: 'KPWT', name: 'Bremerton National', lat: 47.4880, lng: -122.7630 },
    'KTIW': { code: 'KTIW', name: 'Tacoma Narrows', lat: 47.2681, lng: -122.5769 },
    'TIW': { code: 'KTIW', name: 'Tacoma Narrows', lat: 47.2681, lng: -122.5769 },
    '0S9': { code: '0S9', name: 'Jefferson County', lat: 48.0531, lng: -122.8106 },
    'KAWO': { code: 'KAWO', name: 'Arlington Municipal', lat: 48.1611, lng: -122.1583 },
    'AWO': { code: 'KAWO', name: 'Arlington Municipal', lat: 48.1611, lng: -122.1583 },
    'KCLM': { code: 'KCLM', name: 'William R Fairchild', lat: 48.1206, lng: -123.4961 },
    'KFHR': { code: 'KFHR', name: 'Friday Harbor', lat: 48.5222, lng: -123.0236 },
    'FHR': { code: 'KFHR', name: 'Friday Harbor', lat: 48.5222, lng: -123.0236 },
    'KBLI': { code: 'KBLI', name: 'Bellingham International', lat: 48.7928, lng: -122.5372 },
    'BLI': { code: 'KBLI', name: 'Bellingham International', lat: 48.7928, lng: -122.5372 },
    'KOLM': { code: 'KOLM', name: 'Olympia Regional', lat: 46.9744, lng: -122.9022 },
    'OLM': { code: 'KOLM', name: 'Olympia Regional', lat: 46.9744, lng: -122.9022 },
    'S43': { code: 'S43', name: 'Harvey Field', lat: 47.9094, lng: -122.1067 },
    'W36': { code: 'W36', name: 'Lovering Field', lat: 45.4746, lng: -122.6841 }, // Approximate
    'KAST': { code: 'KAST', name: 'Astoria Regional', lat: 46.1581, lng: -123.8786 },
    'AST': { code: 'KAST', name: 'Astoria Regional', lat: 46.1581, lng: -123.8786 },
    // Missing from global DB:
    'W10': { code: 'W10', name: 'Whidbey Air Park', lat: 48.0176, lng: -122.4377 },
    'S14': { code: 'S14', name: 'Westport Airport', lat: 46.8970, lng: -124.1007 },
    '14S': { code: '14S', name: 'Westport Airport', lat: 46.8970, lng: -124.1007 },
    'S16': { code: 'S16', name: 'Copalis State Airport', lat: 47.1449, lng: -124.1893 },
    'S18': { code: 'S18', name: 'Forks Airport', lat: 47.9377, lng: -124.3959 },
};
