
import { useEffect } from 'react';
import MapComponent from './components/Map';
import AirportControls from './components/AirportControls';
import { useAirportStore } from './store/useAirportStore';

function App() {
  const { user, loadUserAirports, syncAirports, isSharedView, setSharedView, setAirports } = useAirportStore();

  useEffect(() => {
    console.log('[V1.23] Airport Tracker initialized');
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedUserId = params.get('share');

    if (sharedUserId) {
      loadUserAirports(sharedUserId);
    } else if (isSharedView) {
      // Reverting from a shared view to a personal view
      if (user) {
        syncAirports();
      } else {
        setAirports([]);
      }
      setSharedView(false);
    }
  }, [user, isSharedView, loadUserAirports, syncAirports, setSharedView, setAirports]);

  const isSharedInUrl = new URLSearchParams(window.location.search).has('share');

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-100 flex flex-col">
      {isSharedInUrl && (
        <div className="absolute top-4 right-4 z-[1000] bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl shadow-lg flex items-center gap-4 backdrop-blur-sm bg-opacity-95">
          <div className="flex flex-col">
            <span className="font-bold text-[10px] uppercase tracking-wider text-yellow-600">Viewing Shared Map</span>
            <a
              href={window.location.origin + window.location.pathname}
              className="text-sm text-blue-600 hover:text-blue-800 font-bold transition-colors"
            >
              Start your own tracker &rarr;
            </a>
          </div>
          <button
            onClick={() => window.location.href = window.location.origin + window.location.pathname}
            className="w-6 h-6 flex items-center justify-center hover:bg-yellow-200 rounded-full transition-colors text-lg"
            title="Back to my map"
          >
            &times;
          </button>
        </div>
      )}
      <div className="flex-1 relative">
        <MapComponent />
        {!isSharedInUrl && <AirportControls />}
      </div>
    </div>
  );
}

export default App;
