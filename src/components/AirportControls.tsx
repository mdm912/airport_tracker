import React, { useState } from 'react';
import Papa from 'papaparse';
import { useAirportStore } from '../store/useAirportStore';
import { Upload, Plane, Search, Trash2, List, Share2, Check, Settings, Map as MapIcon, X, CheckSquare, Square } from 'lucide-react';
import type { Airport, AirportType } from '../types';
import { Auth } from './Auth';

const AirportControls: React.FC = () => {
    const { airports, user, importFlightLog, addAirports, addManualAirport, addAirport, removeAirport, clearAirports, mapLayer, setMapLayer } = useAirportStore();
    const [isOpen, setIsOpen] = useState(true);
    const [mode, setMode] = useState<'upload' | 'manual' | 'manage' | 'settings'>('upload');
    const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
    const [isCopied, setIsCopied] = useState(false);

    // Import Preview State
    const [importPreview, setImportPreview] = useState<Airport[] | null>(null);
    const [selectedImportIds, setSelectedImportIds] = useState<Set<string>>(new Set());

    React.useEffect(() => {
        if (statusMessage) {
            const timer = setTimeout(() => setStatusMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    const handleShare = () => {
        if (!user) return;
        const url = `${window.location.origin}${window.location.pathname}?share=${user.id}`;
        navigator.clipboard.writeText(url);
        setIsCopied(true);
        setStatusMessage({ text: 'Share link copied!', type: 'success' });
        setTimeout(() => setIsCopied(false), 2000);
    };

    const [candidates, setCandidates] = useState<any[]>([]);

    // Manual form state
    const [manualForm, setManualForm] = useState({
        code: '',
        type: 'visited' as AirportType,
        lat: '',
        lng: '',
        name: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showCustomFields, setShowCustomFields] = useState(false);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: false,
            complete: (results) => {
                const rows = results.data as string[][];
                const flightTableStartIndex = rows.findIndex(row => row[0]?.includes('Flights Table'));

                if (flightTableStartIndex === -1) {
                    alert('Could not find Flights Table in the CSV');
                    return;
                }

                const headersRowIndex = flightTableStartIndex + 1;
                const headers = rows[headersRowIndex];

                const dateIndex = headers.indexOf('Date');
                const fromIndex = headers.indexOf('From');
                const toIndex = headers.indexOf('To');
                const routeIndex = headers.indexOf('Route');

                console.log(`Found columns - Date: ${dateIndex}, From: ${fromIndex}, To: ${toIndex}, Route: ${routeIndex}`);

                const entries = rows.slice(headersRowIndex + 1).map(row => ({
                    date: row[dateIndex],
                    from: row[fromIndex],
                    to: row[toIndex],
                    route: row[routeIndex]
                })).filter(entry => entry.date && entry.from && entry.to);

                console.log(`[V1.7] Parsed ${entries.length} valid flight entries.`);

                importFlightLog(entries).then((foundAirports) => {
                    console.log(`[V1.7] Store returned ${foundAirports.length} new airports.`);
                    if (foundAirports.length === 0) {
                        alert('Log processed. No new airports found to add.');
                        return;
                    }
                    setImportPreview(foundAirports);
                    setSelectedImportIds(new Set(foundAirports.map(a => a.id)));
                }).catch(e => {
                    console.error('Import error:', e);
                    alert("Import failed unexpectedly.");
                });
            }
        });
    };

    const handleConfirmImport = async () => {
        if (!importPreview) return;
        const toAdd = importPreview.filter(a => selectedImportIds.has(a.id));
        if (toAdd.length > 0) {
            await addAirports(toAdd);
            setStatusMessage({ text: `Successfully added ${toAdd.length} new airports!`, type: 'success' });
        }
        setImportPreview(null);
        setSelectedImportIds(new Set());
        setMode('manage');
    };

    const toggleImportSelection = (id: string) => {
        const next = new Set(selectedImportIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedImportIds(next);
    };

    const toggleAllImports = () => {
        if (!importPreview) return;
        if (selectedImportIds.size === importPreview.length) {
            setSelectedImportIds(new Set());
        } else {
            setSelectedImportIds(new Set(importPreview.map(a => a.id)));
        }
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!manualForm.code) {
            alert("Airport Code is required.");
            return;
        }

        setIsSubmitting(true);
        setCandidates([]); // Clear previous results

        // If custom fields are visible and filled, use them
        if (showCustomFields && manualForm.lat && manualForm.lng) {
            addAirport({
                id: crypto.randomUUID(),
                code: manualForm.code.toUpperCase(),
                name: manualForm.name || undefined,
                lat: parseFloat(manualForm.lat),
                lng: parseFloat(manualForm.lng),
                type: manualForm.type,
                notes: 'Manually added custom airport',
                dateVisited: manualForm.type === 'visited' ? new Date().toISOString().split('T')[0] : undefined
            });
            setStatusMessage({ text: `Added custom airport ${manualForm.code}.`, type: 'success' });
            setManualForm(prev => ({ ...prev, code: '', lat: '', lng: '', name: '' }));
            setShowCustomFields(false);
            setIsSubmitting(false);
            return;
        }

        // Database lookup
        const result = await addManualAirport(manualForm.code, manualForm.type);

        if (result.status === 'success') {
            setStatusMessage({ text: result.message || 'Added successfully', type: 'success' });
            setManualForm(prev => ({ ...prev, code: '' }));
            setShowCustomFields(false);
            setCandidates([]);
        } else if (result.status === 'ambiguous' && result.candidates) {
            setCandidates(result.candidates);
        } else {
            // Not found
            setStatusMessage({ text: result.message || `"${manualForm.code}" not found.`, type: 'error' });
            if (confirm(`"${manualForm.code}" not found. Enter manual coordinates?`)) {
                setShowCustomFields(true);
            }
        }
        setIsSubmitting(false);
    };

    const handleCandidateSelect = async (candidate: any) => {
        // When selecting a candidate, we search again by their specific Ident
        // This hits the exact match path in the store.
        const result = await addManualAirport(candidate.ident, manualForm.type);
        if (result.status === 'success') {
            setStatusMessage({ text: result.message || 'Added successfully', type: 'success' });
            setManualForm(prev => ({ ...prev, code: '' }));
            setCandidates([]);
        } else {
            setStatusMessage({ text: result.message || 'Error adding airport.', type: 'error' });
        }
    };

    return (
        <div className={`absolute bottom-8 left-4 z-[1000] bg-white p-4 rounded-lg shadow-xl w-80 transition-all ${isOpen ? 'opacity-100' : 'opacity-90'}`}>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2"><Plane className="h-5 w-5" /> Flight Log</h2>
                <div className="flex items-center gap-2">
                    {user && (
                        <button
                            onClick={handleShare}
                            className={`p-1.5 rounded-full transition-all flex items-center gap-1 ${isCopied ? 'bg-green-50 text-green-600' : 'text-blue-600 hover:bg-blue-50'}`}
                            title={isCopied ? 'Copied!' : 'Share Map'}
                        >
                            {isCopied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                            {isCopied && <span className="text-[10px] font-bold pr-1">Copied!</span>}
                        </button>
                    )}
                    <button onClick={() => setIsOpen(!isOpen)} className="text-sm text-gray-500 hover:text-black">
                        {isOpen ? 'Minimize' : 'Expand'}
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className="space-y-4">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-200">
                        <button
                            className={`flex-1 py-2 text-sm font-medium ${mode === 'upload' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setMode('upload')}
                        >
                            Upload
                        </button>
                        <button
                            className={`flex-1 py-2 text-sm font-medium ${mode === 'manual' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setMode('manual')}
                        >
                            Add
                        </button>
                        <button
                            className={`flex-1 py-2 text-sm font-medium ${mode === 'manage' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setMode('manage')}
                        >
                            Manage
                        </button>
                        <button
                            className={`flex-1 py-2 text-sm font-medium ${mode === 'settings' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setMode('settings')}
                        >
                            Settings
                        </button>
                    </div>

                    {mode === 'upload' ? (
                        <>
                            {importPreview ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-sm font-bold text-gray-700">Preview Import</h3>
                                        <button onClick={() => setImportPreview(null)} className="text-gray-400 hover:text-black">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">
                                        From your log: {importPreview.length} items found.
                                    </p>
                                    <div className="flex items-center gap-2 mb-2">
                                        <button
                                            onClick={toggleAllImports}
                                            className="text-[10px] flex items-center gap-1 text-blue-600 font-bold hover:underline"
                                        >
                                            {selectedImportIds.size === importPreview.length ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                                            {selectedImportIds.size === importPreview.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-2 bg-gray-50 custom-scrollbar">
                                        {importPreview.map((ap) => (
                                            <div
                                                key={ap.id}
                                                className="flex items-center gap-3 p-2 bg-white rounded border border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors"
                                                onClick={() => toggleImportSelection(ap.id)}
                                            >
                                                {selectedImportIds.has(ap.id) ? (
                                                    <CheckSquare className="h-4 w-4 text-blue-600" />
                                                ) : (
                                                    <Square className="h-4 w-4 text-gray-300" />
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-xs">{ap.code}</span>
                                                            <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{ap.name}</span>
                                                        </div>
                                                        {ap.source && (
                                                            <span className={`text-[8px] uppercase px-1.5 py-0.5 rounded-full font-bold border ${ap.source === 'from' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                                ap.source === 'to' ? 'bg-green-50 text-green-600 border-green-100' :
                                                                    'bg-purple-50 text-purple-600 border-purple-100'
                                                                }`}>
                                                                {ap.source}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleConfirmImport}
                                        disabled={selectedImportIds.size === 0}
                                        className={`w-full py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white transition-all ${selectedImportIds.size === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}
                                    >
                                        Import {selectedImportIds.size} Airports
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="border border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative">
                                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                                        <span className="text-sm text-gray-600">Upload ForeFlight CSV</span>
                                        <input
                                            type="file"
                                            accept=".csv"
                                            onChange={handleFileUpload}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        <p>Supporting ForeFlight exports.</p>
                                    </div>
                                </>
                            )}
                        </>
                    ) : mode === 'manual' ? (
                        <div className="space-y-3">
                            {candidates.length > 0 ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <p className="text-xs font-bold text-gray-700">Did you mean?</p>
                                        <button
                                            onClick={() => setCandidates([])}
                                            className="text-xs text-red-500 hover:underline"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-1 border rounded-md p-1 bg-gray-50">
                                        {candidates.map((c) => (
                                            <button
                                                key={c.ident}
                                                onClick={() => handleCandidateSelect(c)}
                                                className="w-full text-left p-2 text-xs hover:bg-blue-100 rounded border-b last:border-0 border-gray-100 transition-colors"
                                            >
                                                <span className="font-bold block">{c.ident}</span>
                                                <span className="block truncate">{c.name}</span>
                                                <span className="text-gray-500 block truncate">{c.municipality}, {c.iso_region}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleManualSubmit} className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700">Airport Code or Name</label>
                                        <div className="mt-1 relative rounded-md shadow-sm">
                                            <input
                                                type="text"
                                                placeholder="e.g. JFK or Forks"
                                                className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                                                value={manualForm.code}
                                                onChange={e => setManualForm({ ...manualForm, code: e.target.value })}
                                            />
                                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                <Search className="h-4 w-4 text-gray-400" />
                                            </div>
                                        </div>
                                    </div>

                                    {showCustomFields && (
                                        <div className="p-3 bg-gray-50 rounded-md space-y-2 border border-blue-100">
                                            <p className="text-xs text-blue-600 font-medium">Custom Airport Details</p>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700">Name</label>
                                                <input
                                                    type="text"
                                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-1 border"
                                                    value={manualForm.name}
                                                    onChange={e => setManualForm({ ...manualForm, name: e.target.value })}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700">Lat</label>
                                                    <input
                                                        type="number" step="any"
                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-1 border"
                                                        value={manualForm.lat}
                                                        onChange={e => setManualForm({ ...manualForm, lat: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700">Lng</label>
                                                    <input
                                                        type="number" step="any"
                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-1 border"
                                                        value={manualForm.lng}
                                                        onChange={e => setManualForm({ ...manualForm, lng: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-medium text-gray-700">Type</label>
                                        <select
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border bg-white"
                                            value={manualForm.type}
                                            onChange={e => setManualForm({ ...manualForm, type: e.target.value as AirportType })}
                                        >
                                            <option value="visited">Visited (or Fuel Stop)</option>
                                            <option value="wishlist">Wishlist / Planned</option>
                                        </select>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${isSubmitting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                                    >
                                        {isSubmitting ? 'Searching...' : (showCustomFields ? 'Add Custom Airport' : 'Find & Add')}
                                    </button>

                                    {statusMessage && (
                                        <div className={`mt-2 text-xs font-medium text-center p-2 rounded ${statusMessage.type === 'success' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                                            {statusMessage.text}
                                        </div>
                                    )}

                                    {!showCustomFields && (
                                        <p className="text-xs text-gray-500 text-center">
                                            * Searches 70k+ airports by Code or Name.
                                        </p>
                                    )}
                                </form>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">Added Airports ({airports.length})</p>
                                {airports.length > 0 && (
                                    <button
                                        onClick={() => {
                                            if (confirm('Are you sure you want to clear ALL airports? This cannot be undone.')) {
                                                clearAirports();
                                            }
                                        }}
                                        className="text-[10px] text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
                                    >
                                        <Trash2 className="h-3 w-3" /> Clear All
                                    </button>
                                )}
                            </div>

                            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {airports.length === 0 ? (
                                    <div className="text-center py-8">
                                        <List className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                                        <p className="text-sm text-gray-400">No airports added yet.</p>
                                    </div>
                                ) : (
                                    airports.map((airport) => (
                                        <div key={airport.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-md border border-gray-100 group">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-xs">{airport.code}</span>
                                                    <span className={`h-2 w-2 rounded-full ${airport.type === 'visited' ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                                                </div>
                                                <p className="text-[10px] text-gray-500 truncate">{airport.name || 'Unknown name'}</p>
                                            </div>
                                            <button
                                                onClick={() => removeAirport(airport.id)}
                                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all ml-2"
                                                title="Remove"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                    {mode === 'settings' && (
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    <MapIcon className="h-4 w-4" /> Map Display
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setMapLayer('osm')}
                                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${mapLayer === 'osm' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
                                    >
                                        OpenStreetMap
                                    </button>
                                    <button
                                        onClick={() => setMapLayer('sectional')}
                                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${mapLayer === 'sectional' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
                                    >
                                        VFR Sectional
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    <Settings className="h-4 w-4" /> Account
                                </h3>
                                <Auth />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AirportControls;
