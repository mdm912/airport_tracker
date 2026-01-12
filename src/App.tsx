
import { useEffect } from 'react';
import MapComponent from './components/Map';
import AirportControls from './components/AirportControls';
import { useAirportStore } from './store/useAirportStore';

function App() {
  const { loadUserAirports } = useAirportStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedUserId = params.get('share');
    if (sharedUserId) {
      loadUserAirports(sharedUserId);
    }
  }, [loadUserAirports]);

  const isSharedView = new URLSearchParams(window.location.search).has('share');

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-100 flex flex-col">
      {isSharedView && (
        <div className="absolute top-4 right-4 z-[1000] bg-yellow-100 border border-yellow-200 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm animate-pulse">
          Viewing Shared Map
        </div>
      )}
      <div className="flex-1 relative">
        <MapComponent />
        {!isSharedView && <AirportControls />}
      </div>
    </div>
  );
}

export default App;
