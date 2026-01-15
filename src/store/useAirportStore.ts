import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Airport, FlightLogEntry, AirportType } from '../types';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import Papa from 'papaparse';

interface AirportState {
    airports: Airport[];
    user: User | null;
    isLoading: boolean;
    setUser: (user: User | null) => void;
    addAirport: (airport: Airport) => Promise<void>;
    addAirports: (airports: Airport[]) => Promise<void>;
    removeAirport: (id: string) => Promise<void>;
    syncAirports: () => Promise<void>;
    importFlightLog: (entries: FlightLogEntry[]) => Promise<Airport[]>;
    addManualAirport: (input: string, type: AirportType) => Promise<{
        status: 'success' | 'ambiguous' | 'not_found';
        candidates?: any[];
        message?: string;
    }>;
    mapLayer: 'osm' | 'sectional';
    setMapLayer: (layer: 'osm' | 'sectional') => void;
    getAirportByCode: (code: string) => Airport | undefined;
    clearAirports: () => Promise<void>;
    loadUserAirports: (userId: string) => Promise<void>;
    focusAirportId: string | null;
    setFocusAirportId: (id: string | null) => void;
    isSharedView: boolean;
    setSharedView: (isShared: boolean) => void;
    setAirports: (airports: Airport[]) => void;
}

// Helper to fetch and normalize DB
let cachedDB: any[] | null = null;

const fetchAirportDB = async () => {
    if (cachedDB) return cachedDB;

    const baseUrl = import.meta.env.BASE_URL || '/';
    const url = baseUrl.endsWith('/') ? `${baseUrl}airports.csv` : `${baseUrl}/airports.csv`;

    console.log('Fetching airport database from:', url);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load airport database: ${response.statusText}`);
    const csvText = await response.text();

    return new Promise<any[]>((resolve, reject) => {
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                console.log(`Parsed ${results.data.length} airports from database.`);
                cachedDB = results.data;
                resolve(results.data as any[]);
            },
            error: (err: any) => reject(err)
        });
    });
};

export const useAirportStore = create<AirportState>()(
    persist(
        (set, get) => ({
            airports: [],
            user: null,
            isLoading: false,
            focusAirportId: null,
            setFocusAirportId: (id) => set({ focusAirportId: id }),
            isSharedView: false,
            setSharedView: (isShared) => set({ isSharedView: isShared }),
            setAirports: (airports) => set({ airports }),
            mapLayer: 'sectional',
            setMapLayer: (layer) => set({ mapLayer: layer }),
            setUser: async (user) => {
                const prevUser = get().user;
                const localAirports = get().airports;

                set({ user });

                if (user) {
                    console.log('User signed in:', user.email);
                    await get().syncAirports();

                    // If we just logged in and have local guest data, merge it
                    if (!prevUser && localAirports.length > 0) {
                        const cloudAirports = get().airports;
                        const toSync = localAirports.filter(local =>
                            !cloudAirports.some(cloud => cloud.code === local.code && cloud.type === local.type)
                        );

                        if (toSync.length > 0) {
                            console.log(`Merging ${toSync.length} guest airports into account...`);
                            const dbEntries = toSync.map(a => ({
                                id: a.id,
                                user_id: user.id,
                                code: a.code,
                                name: a.name,
                                lat: a.lat,
                                lng: a.lng,
                                type: a.type,
                                notes: a.notes,
                                date_visited: a.dateVisited
                            }));

                            const { error } = await supabase.from('airports').insert(dbEntries);
                            if (error) {
                                console.error('Merge error:', error);
                                alert(`Failed to sync guest data: ${error.message}`);
                            } else {
                                await get().syncAirports();
                            }
                        }
                    }
                } else {
                    // Only clear state on explicit logout
                    if (prevUser) {
                        console.log('User signed out, clearing local pins.');
                        set({ airports: [] });
                    }
                }
            },
            syncAirports: async () => {
                const { user } = get();
                set({ isSharedView: false });
                if (!user) return;

                set({ isLoading: true });
                const { data, error } = await supabase
                    .from('airports')
                    .select('*')
                    .eq('user_id', user.id);

                if (error) {
                    console.error('Sync error:', error);
                    alert(`Cloud Sync Failed: ${error.message}\n(Please ensure you ran the SQL script in your Supabase SQL Editor)`);
                } else {
                    const normalized = data.map((d: any) => ({
                        id: d.id,
                        code: d.code,
                        name: d.name,
                        lat: d.lat,
                        lng: d.lng,
                        type: d.type as AirportType,
                        notes: d.notes,
                        dateVisited: d.date_visited
                    }));
                    set({ airports: normalized });
                }
                set({ isLoading: false });
            },
            addAirport: async (airport) => {
                const { user } = get();

                // Prevent local duplicates
                if (get().airports.some((a) => a.code === airport.code && a.type === airport.type)) {
                    return;
                }

                set((state) => ({
                    airports: [...state.airports, airport],
                    focusAirportId: airport.id
                }));

                if (user) {
                    const { error } = await supabase.from('airports').insert({
                        id: airport.id,
                        user_id: user.id,
                        code: airport.code,
                        name: airport.name,
                        lat: airport.lat,
                        lng: airport.lng,
                        type: airport.type,
                        notes: airport.notes,
                        date_visited: airport.dateVisited
                    });
                    if (error) {
                        console.error('Supabase error:', error);
                    }
                }
            },
            addAirports: async (newAirports) => {
                const { user } = get();
                if (newAirports.length === 0) return;

                set((state) => ({
                    airports: [...state.airports, ...newAirports],
                    focusAirportId: newAirports[newAirports.length - 1].id
                }));

                if (user) {
                    const dbEntries = newAirports.map(a => ({
                        id: a.id,
                        user_id: user.id,
                        code: a.code,
                        name: a.name,
                        lat: a.lat,
                        lng: a.lng,
                        type: a.type,
                        notes: a.notes,
                        date_visited: a.dateVisited
                    }));
                    const { error } = await supabase.from('airports').insert(dbEntries);
                    if (error) {
                        console.error('Supabase error:', error);
                        alert(`Failed to save to cloud: ${error.message}`);
                    }
                }
            },
            removeAirport: async (id) => {
                const { user, focusAirportId } = get();
                set((state) => ({
                    airports: state.airports.filter((a) => a.id !== id),
                    focusAirportId: focusAirportId === id ? null : focusAirportId
                }));

                if (user) {
                    const { error } = await supabase.from('airports').delete().eq('id', id);
                    if (error) console.error('Supabase error:', error);
                }
            },
            getAirportByCode: (code) => {
                return get().airports.find((a) => a.code === code);
            },
            addManualAirport: async (input, type) => {
                const searchStr = input.trim().toUpperCase();

                try {
                    const allAirports = await fetchAirportDB();

                    // 1. Strict Code Match (Ident, IATA, Local, GPS)
                    let entry = allAirports.find((a: any) =>
                        a.ident === searchStr ||
                        a.iata_code === searchStr ||
                        a.local_code === searchStr ||
                        a.gps_code === searchStr
                    );

                    // 2. Partial Name Match (if no exact code match)
                    if (!entry) {
                        const candidates = allAirports.filter((a: any) =>
                            a.name && a.name.toUpperCase().includes(searchStr)
                        );

                        if (candidates.length === 1) {
                            entry = candidates[0];
                        } else if (candidates.length > 1) {
                            return {
                                status: 'ambiguous',
                                candidates: candidates.slice(0, 10), // Limit results for UI
                                message: `Multiple matches found for "${input}". Please select one:`
                            };
                        }
                    }

                    if (!entry) {
                        return { status: 'not_found', message: `No exact code or name matches for "${input}".` };
                    }

                    // Prefer the entered code if it matches IATA or Local code
                    let code = entry.ident;
                    const cleanInput = input.trim().toUpperCase();
                    if (entry.iata_code === cleanInput || entry.local_code === cleanInput) {
                        code = cleanInput;
                    }

                    const existing = get().airports.find(a => a.code === code && a.type === type);

                    if (existing) {
                        return { status: 'success', message: `Airport ${code} (${entry.name}) is already in your ${type} list.` };
                    }

                    const newAirport: Airport = {
                        id: crypto.randomUUID(),
                        code: code,
                        name: entry.name,
                        lat: parseFloat(entry.latitude_deg),
                        lng: parseFloat(entry.longitude_deg),
                        type,
                        dateVisited: type === 'visited' ? new Date().toISOString().split('T')[0] : undefined,
                        notes: `Manually added: "${input}".`
                    };

                    await get().addAirport(newAirport);
                    return { status: 'success', message: `Added ${entry.name} (${code})` };
                } catch (e) {
                    console.error(e);
                    return { status: 'not_found', message: 'Database error' };
                }
            },
            importFlightLog: async (entries) => {
                const { airports } = get();
                const newAirports: Airport[] = [];
                const seenCodesInOperation = new Set<string>();
                const existingCodes = new Set(airports.map(a => a.code));

                try {
                    const allAirports = await fetchAirportDB();
                    // Each code maps to an array of possible airports
                    const lookupMap = new Map<string, any[]>();

                    const addToMap = (code: string, ap: any) => {
                        if (!code) return;
                        if (!lookupMap.has(code)) lookupMap.set(code, []);
                        lookupMap.get(code)?.push(ap);
                    };

                    allAirports.forEach((ap: any) => {
                        addToMap(ap.ident, ap);
                        addToMap(ap.icao_code, ap);
                        addToMap(ap.iata_code, ap);
                        addToMap(ap.gps_code, ap);
                        addToMap(ap.local_code, ap);
                    });

                    // Utility to find the "best" airport from a list of candidates
                    const findBest = (candidates: any[], targetCode: string, preferredCountries?: string[]) => {
                        if (!candidates || candidates.length === 0) return null;

                        return [...candidates].sort((a, b) => {
                            const getScore = (ap: any) => {
                                let score = 0;
                                if (preferredCountries?.includes(ap.iso_country)) score += 50;
                                if (ap.iso_country === 'US') score += 10;
                                if (ap.type === 'large_airport') score += 5;
                                if (ap.type === 'medium_airport') score += 3;
                                if (ap.type === 'small_airport') score += 1;
                                if (ap.ident === targetCode) score += 20;
                                if (ap.type === 'closed') score -= 100;
                                return score;
                            };
                            return getScore(b) - getScore(a);
                        })[0];
                    };

                    entries.forEach(entry => {
                        const fromCode = entry.from.trim().toUpperCase();
                        const toCode = entry.to.trim().toUpperCase();

                        // 1. Find best From/To to establish country context
                        const fromAp = findBest(lookupMap.get(fromCode) || [], fromCode);
                        const toAp = findBest(lookupMap.get(toCode) || [], toCode);

                        const contextCountries = Array.from(new Set([fromAp?.iso_country, toAp?.iso_country].filter(Boolean) as string[]));

                        const processCode = (rawCode: string, source: 'from' | 'to' | 'route') => {
                            if (!rawCode) return;
                            const code = rawCode.trim().toUpperCase();

                            const candidates = lookupMap.get(code) || [];
                            if (candidates.length === 0) return;

                            // For route airports, we ONLY consider airports in the context countries
                            // This filters out Nav Aids (which won't be in our DB) or international airports with same code.
                            let filteredCandidates = candidates;
                            if (source === 'route' && contextCountries.length > 0) {
                                filteredCandidates = candidates.filter(ap => contextCountries.includes(ap.iso_country));
                            }

                            // Also filter out closed airports for route
                            if (source === 'route') {
                                filteredCandidates = filteredCandidates.filter(ap => ap.type !== 'closed');
                            }

                            const best = findBest(filteredCandidates, code, contextCountries);
                            if (!best) return;

                            // Prefer the log code if it matches IATA or Local code
                            let finalCode = best.ident;
                            if (best.iata_code === code || best.local_code === code) {
                                finalCode = code;
                            }

                            if (existingCodes.has(finalCode) || seenCodesInOperation.has(finalCode)) return;

                            newAirports.push({
                                id: crypto.randomUUID(),
                                code: finalCode,
                                name: best.name,
                                lat: parseFloat(best.latitude_deg),
                                lng: parseFloat(best.longitude_deg),
                                type: 'visited',
                                dateVisited: entry.date,
                                notes: `Imported from flight log.`,
                                source: source
                            });
                            seenCodesInOperation.add(code);
                            seenCodesInOperation.add(best.ident);
                            seenCodesInOperation.add(finalCode);
                        };

                        processCode(entry.from, 'from');
                        processCode(entry.to, 'to');

                        // Process route field if it exists
                        if (entry.route) {
                            const routeCodes = entry.route.split(/[\s->]+/).filter(Boolean);
                            routeCodes.forEach(code => processCode(code, 'route'));
                        }
                    });

                    return newAirports;
                } catch (error) {
                    console.error("Failed to map airports", error);
                    throw error;
                }
            },
            clearAirports: async () => {
                const { user } = get();
                set({ airports: [] });
                if (user) {
                    const { error } = await supabase.from('airports').delete().eq('user_id', user.id);
                    if (error) console.error('Supabase error:', error);
                }
            },
            loadUserAirports: async (userId) => {
                set({ isLoading: true, isSharedView: true });
                const { data, error } = await supabase
                    .from('airports')
                    .select('*')
                    .eq('user_id', userId);

                if (error) {
                    console.error('Error loading public airports:', error);
                } else {
                    const normalized = data.map((d: any) => ({
                        id: d.id,
                        code: d.code,
                        name: d.name,
                        lat: d.lat,
                        lng: d.lng,
                        type: d.type as AirportType,
                        notes: d.notes,
                        dateVisited: d.date_visited
                    }));
                    set({ airports: normalized });
                }
                set({ isLoading: false });
            },
        }),
        {
            name: 'airport-storage',
            partialize: (state) => ({ airports: state.airports }), // Don't persist user state
        }
    )
);
