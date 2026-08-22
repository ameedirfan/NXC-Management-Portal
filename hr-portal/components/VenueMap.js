'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet + OpenStreetMap tiles, no API key, no billing account — see
// the geo check-in spec section 3. Marker icons are pulled from unpkg's
// CDN (same "no self-hosted asset to manage" approach the QR code image
// already uses elsewhere in this app) rather than bundling Leaflet's
// default icon files, which break under Next.js's bundler unless
// manually patched.
const MARKER_ICON = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Islamabad-wide default view, used only when no venue is pinned yet —
// the admin/manager pans and clicks (or uses "current location") to set
// the actual venue, this is just a sane starting viewport.
const DEFAULT_CENTER = [33.6844, 73.0479];
const DEFAULT_ZOOM = 12;
const PIN_ZOOM = 16;

// Controlled-ish map: `value` seeds the initial pin, `onChange` fires on
// every user-driven placement (click, drag, or geolocation). There is no
// prop-driven repositioning after mount, if a parent needs to reset the
// map, remount it with a different `key`, simpler and safer than
// reconciling external updates against Leaflet's own imperative state.
export default function VenueMap({ value, onChange, className = '' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: value ? [value.lat, value.lng] : DEFAULT_CENTER,
      zoom: value ? PIN_ZOOM : DEFAULT_ZOOM,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    function placeMarker(lat, lng) {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const marker = L.marker([lat, lng], { icon: MARKER_ICON, draggable: true }).addTo(map);
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onChange({ lat: pos.lat, lng: pos.lng });
        });
        markerRef.current = marker;
      }
    }

    if (value) placeMarker(value.lat, value.lng);

    map.on('click', (e) => {
      placeMarker(e.latlng.lat, e.latlng.lng);
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocateError('Your browser does not support location access.');
      return;
    }
    setLocating(true);
    setLocateError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocating(false);
        const map = mapRef.current;
        if (!map) return;
        map.setView([latitude, longitude], PIN_ZOOM);
        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        } else {
          const marker = L.marker([latitude, longitude], { icon: MARKER_ICON, draggable: true }).addTo(map);
          marker.on('dragend', () => {
            const p = marker.getLatLng();
            onChange({ lat: p.lat, lng: p.lng });
          });
          markerRef.current = marker;
        }
        onChange({ lat: latitude, lng: longitude });
      },
      (err) => {
        setLocating(false);
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access was denied. Pin the venue manually instead.'
            : 'Could not get your current location. Pin the venue manually instead.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
        >
          {locating ? 'Getting location…' : 'Use my current location'}
        </button>
        <p className="text-xs text-brand-700">Or tap the map to pin manually, drag the pin to fine tune.</p>
      </div>

      {locateError && <p className="mt-2 text-sm nxc-error-text">{locateError}</p>}

      {/* `isolate` matters more than it looks. Leaflet hard-codes a tall
          z-index ladder on its own panes and controls (up to 1000), and
          <main> creates no stacking context, so those numbers were
          competing directly with the app's chrome instead of staying
          inside the map — the venue map punched straight through the
          welcome overlay (z-400), and would equally have covered the
          toast (z-200) and the Command Palette (z-100). Isolating here
          scopes Leaflet's whole ladder to this box, which fixes all
          three at the source rather than escalating every overlay's
          z-index to outrun a third-party stylesheet. */}
      <div
        ref={containerRef}
        className="isolate mt-3 h-72 w-full overflow-hidden rounded-lg border border-brand-300"
      />

      {value && (
        <p className="mt-2 text-xs text-brand-700">
          Pinned at {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}
